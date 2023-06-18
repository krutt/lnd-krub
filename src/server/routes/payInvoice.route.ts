// ~~/src/server/routes/payInvoice.route.ts

// imports
import Frisbee from 'frisbee'
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import {
  calculateBalance,
  clearBalanceCache,
  loadUserByAuthorization,
  lockFunds,
  getPaymentHashPaid,
  getUserIdByPaymentHash,
  savePaidLndInvoice,
  unlockFunds,
} from '@/server/models/user'
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
import { fetchIdentityPubkey } from '@/server/models/pubkey'
import {
  decodePaymentRequest,
  getPreimage,
  markAsPaidInDatabase,
  setIsPaymentHashPaidInDatabase,
} from '@/server/models/invoice'
import { obtainLock, releaseLock } from '@/server/models/lock'
import { processSendPaymentResponse, sendPayment } from '@/server/models/payment'

const subscribeInvoicesCallCallback = async (response: any) => {
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
    if (!(await obtainLock('groundcontrol_hash_' + LightningInvoiceSettledNotification.hash))) {
      return
    }
    await setIsPaymentHashPaidInDatabase(
      LightningInvoiceSettledNotification.hash,
      LightningInvoiceSettledNotification.amt_paid_sat || 1
    )
    // const user = new User(bitcoin, cache, lightning)
    let userId = await getUserIdByPaymentHash(LightningInvoiceSettledNotification.hash)
    await clearBalanceCache(userId)
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

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  let userId: null | string = await loadUserByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  let identityPubkey: string = await fetchIdentityPubkey()
  let paymentRequest: string = request.body.invoice || request.body.payment_request
  console.log('/payinvoice', [request.uuid, 'userid: ' + userId, 'invoice: ' + paymentRequest])

  if (!paymentRequest) return errorBadArguments(response)
  let freeAmount = 0
  if (request.body.amount) {
    freeAmount = parseInt(request.body.amount)
    if (freeAmount <= 0) return errorBadArguments(response)
  }

  // obtaining a lock
  let lockKey: string = 'invoice_paying_for_' + userId
  if (!(await obtainLock(lockKey))) {
    return errorGeneralServerError(response)
  }

  let balance: number = await calculateBalance(userId).catch(err => {
    console.log('', [request.uuid, 'error running calculateBalance():', err.message])
    return -1
  })
  if (balance < 0) {
    await releaseLock(lockKey)
    return errorTryAgainLater(response)
  }

  let decoded = await decodePaymentRequest(paymentRequest)
  if (!decoded) {
    await releaseLock(lockKey)
    return errorNotAValidInvoice(response)
  } else if (+decoded.num_satoshis === 0) {
    // 'tip' invoices
    decoded.num_satoshis = freeAmount.toFixed(0)
  }

  console.log('/payinvoice', [
    request.uuid,
    'balance: ' + balance,
    'num_satoshis: ' + decoded.num_satoshis,
  ])

  if (
    balance >=
    +decoded.num_satoshis + Math.floor(+decoded.num_satoshis * forwardReserveFee) + 1
  ) {
    // got enough balance, including 1% of payment amount - reserve for fees
    if (identityPubkey === decoded.destination) {
      // this is internal invoice
      // now, receiver add balance
      let recipientId = await getUserIdByPaymentHash(decoded.payment_hash)
      console.log('Recipient:', recipientId)
      if (!recipientId) {
        await releaseLock(lockKey)
        return errorGeneralServerError(response)
      }

      if (await getPaymentHashPaid(decoded.payment_hash)) {
        // this internal invoice was paid, no sense paying it again
        await releaseLock(lockKey)
        return errorLnd(response)
      }
      await clearBalanceCache(recipientId)

      // sender spent his balance:
      await clearBalanceCache(userId)
      await savePaidLndInvoice(
        {
          timestamp: Math.floor(+new Date() / 1000),
          type: 'paid_invoice',
          value: +decoded.num_satoshis + Math.floor(+decoded.num_satoshis * intraHubFee),
          fee: Math.floor(+decoded.num_satoshis * intraHubFee),
          memo: decodeURIComponent(decoded.description),
          pay_req: paymentRequest,
        },
        userId
      )

      await markAsPaidInDatabase(request.body.invoice)

      // now, faking LND callback about invoice paid:
      let preimage = await getPreimage(request.body.invoice)
      if (preimage) {
        subscribeInvoicesCallCallback({
          state: 'SETTLED',
          memo: decoded.description,
          r_preimage: Buffer.from(preimage, 'hex'),
          r_hash: Buffer.from(decoded.payment_hash, 'hex'),
          amt_paid_sat: +decoded.num_satoshis,
        })
      }
      await releaseLock(lockKey)
      return response.send(decoded)
    }

    // else - regular lightning network payment:

    if (!decoded.num_satoshis) {
      // tip invoice, but someone forgot to specify amount
      await releaseLock(lockKey)
      return errorBadArguments(response)
    }
    await lockFunds(paymentRequest, decoded, userId)
    let amount = +decoded.num_satoshis
    let fee = Math.floor(amount * forwardReserveFee) + 1
    let payment = await sendPayment(amount, fee, paymentRequest)
    if (!payment || !!payment.payment_error) {
      // payment failed
      /*await */ releaseLock(lockKey)
      return errorPaymentFailed(response)
    }
    // payment callback
    await unlockFunds(paymentRequest, userId)
    if (payment.payment_route && payment.payment_route.total_amt_msat) {
      payment = processSendPaymentResponse(payment, paymentRequest)
      payment.pay_req = paymentRequest
      payment.decoded = decoded
      // payment.payment_route.total_fees = Math.floor(decoded.num_satoshis * forwardReserveFee)
      // payment.payment_route.total_amt = decoded.num_satoshis
      await savePaidLndInvoice(payment, userId)
      await clearBalanceCache(userId)
      await releaseLock(lockKey)
      return response.send(payment)
    }
    return null
  } else {
    await releaseLock(lockKey)
    return errorNotEnoughBalance(response)
  }
}

export default route
