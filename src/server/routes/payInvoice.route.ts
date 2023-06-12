// ~~/src/server/routes/payInvoice.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import Frisbee from 'frisbee'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { Invo, Lock, Node, Paym, User } from '@/server/models'
import {
  errorBadAuth,
  errorBadArguments,
  errorGeneralServerError,
  errorLnd,
  errorNotAValidInvoice,
  errorNotEnoughBalance,
  errorPaymentFailed,
  errorTryAgainLater,
} from '@/server/exceptions'
import { forwardReserveFee, intraHubFee } from '@/configs'
import { promisify } from 'node:util'

const subscribeInvoicesCallCallback = async (
  bitcoin: BitcoinService,
  lightning: LightningService,
  redis: Redis,
  response: any
) => {
  if (response.state === 'SETTLED') {
    const LightningInvoiceSettledNotification = {
      memo: response.memo,
      preimage: response.r_preimage.toString('hex'),
      hash: response.r_hash.toString('hex'),
      amt_paid_sat: response.amt_paid_msat
        ? Math.floor(response.amt_paid_msat / 1000)
        : response.amt_paid_sat,
    }
    // obtaining a lock, to make sure we push to groundcontrol only once
    // since this web server can have several instances running, and each will get the same callback from LND
    // and dont release the lock - it will autoexpire in a while
    let lock = new Lock('groundcontrol_hash_' + LightningInvoiceSettledNotification.hash, redis)
    if (!(await lock.obtainLock())) {
      return
    }
    let invoice = new Invo(lightning, redis)
    await invoice._setIsPaymentHashPaidInDatabase(
      LightningInvoiceSettledNotification.hash,
      LightningInvoiceSettledNotification.amt_paid_sat || 1
    )
    const user = new User(bitcoin, lightning, redis)
    user._userid = await user.getUseridByPaymentHash(LightningInvoiceSettledNotification.hash)
    await user.clearBalanceCache()
    console.log(
      'payment',
      LightningInvoiceSettledNotification.hash,
      'was paid, posting to GroundControl...'
    )
    const baseURI = process.env.GROUNDCONTROL
    if (!baseURI) return
    const _api = new Frisbee({ baseURI: baseURI })
    const apiResponse = await _api.post(
      '/lightningInvoiceGotSettled',
      Object.assign(
        {},
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: LightningInvoiceSettledNotification,
        }
      )
    )
    console.log('GroundControl:', apiResponse.originalResponse.status)
  }
}
// let subscribeInvoicesCall = lightning.subscribeInvoices({})
// subscribeInvoicesCall.on('data', subscribeInvoicesCallCallback)
// subscribeInvoicesCall.on('status', function (status) {
//   // The current status of the stream.
// })
// subscribeInvoicesCall.on('end', function () {
//   // The server has closed the stream.
// })

export default (
    bitcoin: BitcoinService,
    lightning: LightningService,
    redis: Redis
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    let user = new User(bitcoin, lightning, redis)
    let node = new Node(lightning, redis)
    let identityPubkey = await node.identityPubkey()
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }

    console.log('/payinvoice', [
      request.uuid,
      'userid: ' + user.getUserId(),
      'invoice: ' + request.body.invoice,
    ])

    if (!request.body.invoice) return errorBadArguments(response)
    let freeAmount = 0
    if (request.body.amount) {
      freeAmount = parseInt(request.body.amount)
      if (freeAmount <= 0) return errorBadArguments(response)
    }

    // obtaining a lock
    let lock = new Lock('invoice_paying_for_' + user.getUserId(), redis)
    if (!(await lock.obtainLock())) {
      return errorGeneralServerError(response)
    }

    // @ts-ignore
    let userBalance: number
    try {
      userBalance = await user.getCalculatedBalance()
    } catch (err) {
      console.log('', [request.uuid, 'error running getCalculatedBalance():', err.message])
      lock.releaseLock()
      return errorTryAgainLater(response)
    }

    try {
      let invoice = request.body.invoice
      let info = await promisify(lightning.decodePayReq).bind(lightning)({ pay_req: invoice })
      if (+info.num_satoshis === 0) {
        // 'tip' invoices
        info.num_satoshis = freeAmount
      }

      console.log('/payinvoice', [
        request.uuid,
        'userBalance: ' + userBalance,
        'num_satoshis: ' + info.num_satoshis,
      ])

      if (
        userBalance >=
        +info.num_satoshis + Math.floor(info.num_satoshis * forwardReserveFee) + 1
      ) {
        // got enough balance, including 1% of payment amount - reserve for fees
        if (identityPubkey === info.destination) {
          // this is internal invoice
          // now, receiver add balance
          let userid_payee = await user.getUseridByPaymentHash(info.payment_hash)
          console.log('Payee:', userid_payee)
          if (!userid_payee) {
            await lock.releaseLock()
            return errorGeneralServerError(response)
          }

          if (await user.getPaymentHashPaid(info.payment_hash)) {
            // this internal invoice was paid, no sense paying it again
            await lock.releaseLock()
            return errorLnd(response)
          }

          let UserPayee = new User(bitcoin, lightning, redis)
          UserPayee._userid = userid_payee // hacky, fixme
          await UserPayee.clearBalanceCache()

          // sender spent his balance:
          await user.clearBalanceCache()
          await user.savePaidLndInvoice({
            timestamp: Math.floor(+new Date() / 1000),
            type: 'paid_invoice',
            value: +info.num_satoshis + Math.floor(info.num_satoshis * intraHubFee),
            fee: Math.floor(info.num_satoshis * intraHubFee),
            memo: decodeURIComponent(info.description),
            pay_req: request.body.invoice,
          })

          let invoice = new Invo(lightning, redis)
          invoice.setPaymentRequest(request.body.invoice)
          await invoice.markAsPaidInDatabase()

          // now, faking LND callback about invoice paid:
          let preimage = await invoice.getPreimage()
          if (preimage) {
            subscribeInvoicesCallCallback(bitcoin, lightning, redis, {
              state: 'SETTLED',
              memo: info.description,
              r_preimage: Buffer.from(preimage, 'hex'),
              r_hash: Buffer.from(info.payment_hash, 'hex'),
              amt_paid_sat: +info.num_satoshis,
            })
          }
          await lock.releaseLock()
          return response.send(info)
        }

        // else - regular lightning network payment:

        var call = lightning.sendPayment()
        call.on('data', async function (payment) {
          // payment callback
          await user.unlockFunds(request.body.invoice)
          if (payment && payment.payment_route && payment.payment_route.total_amt_msat) {
            let PaymentShallow = new Paym(null, null)
            payment = PaymentShallow.processSendPaymentResponse(payment)
            payment.pay_req = request.body.invoice
            payment.decoded = info
            await user.savePaidLndInvoice(payment)
            await user.clearBalanceCache()
            lock.releaseLock()
            return response.send(payment)
          } else {
            // payment failed
            lock.releaseLock()
            return errorPaymentFailed(response)
          }
        })
        if (!info.num_satoshis) {
          // tip invoice, but someone forgot to specify amount
          await lock.releaseLock()
          return errorBadArguments(response)
        }
        let inv = {
          payment_request: request.body.invoice,
          amt: info.num_satoshis, // amt is used only for 'tip' invoices
          // @ts-ignore
          fee_limit: { fixed: Math.floor(info.num_satoshis * forwardReserveFee) + 1 },
        }
        try {
          await user.lockFunds(request.body.invoice, info)
          call.write(inv)
          return null
        } catch (Err) {
          await lock.releaseLock()
          return errorPaymentFailed(response)
        }
      } else {
        await lock.releaseLock()
        return errorNotEnoughBalance(response)
      }
    } catch (err) {
      await lock.releaseLock()
      return errorNotAValidInvoice(response)
    }
  }
