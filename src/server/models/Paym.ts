// ~~/src/server/models/Paym.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import { forwardReserveFee, intraHubFee } from '@/configs'
import lightningPayReq from 'bolt11'

export class Paym {
  _bitcoin: BitcoinService
  _lightning: LightningService
  _redis: Redis
  _decoded: {
    destination: string
    expiry: number
    num_satoshis: number
    payment_hash: string
    timestamp: number
  }
  _bolt11: string | boolean
  _isPaid?: boolean

  constructor(bitcoin?: BitcoinService, lightning?: LightningService, redis?: Redis) {
    this._bitcoin = bitcoin
    this._lightning = lightning
    this._redis = redis
    // @ts-ignore
    this._decoded = false
    this._bolt11 = false
    this._isPaid = null
  }

  setInvoice(bolt11) {
    this._bolt11 = bolt11
  }

  async decodePayReqViaRpc(invoice) {
    let that = this
    return new Promise(function (resolve, reject) {
      that._lightning.decodePayReq({ pay_req: invoice }, function (err, info) {
        if (err) return reject(err)
        that._decoded = info
        return resolve(info)
      })
    })
  }

  async queryRoutes() {
    if (!this._bolt11) throw new Error('bolt11 is not provided')
    if (!this._decoded) await this.decodePayReqViaRpc(this._bolt11)

    var request = {
      pub_key: this._decoded.destination,
      amt: this._decoded.num_satoshis,
      final_cltv_delta: 144,
      fee_limit: { fixed: Math.floor(this._decoded.num_satoshis * forwardReserveFee) + 1 },
    }
    let that = this
    return new Promise(function (resolve, reject) {
      that._lightning.queryRoutes(request, function (err, response) {
        if (err) return reject(err)
        resolve(response)
      })
    })
  }

  async sendToRouteSync(routes) {
    if (!this._bolt11) throw new Error('bolt11 is not provided')
    if (!this._decoded) await this.decodePayReqViaRpc(this._bolt11)

    let request = {
      payment_hash_string: this._decoded.payment_hash,
      route: routes[0],
    }

    console.log('sendToRouteSync:', { request })

    let that = this
    return new Promise(function (resolve, reject) {
      // @ts-ignore
      that._lightning.sendToRouteSync(request, function (err, response) {
        if (err) reject(err)
        resolve(that.processSendPaymentResponse(response))
      })
    })
  }

  processSendPaymentResponse(payment) {
    if (payment && payment.payment_route && payment.payment_route.total_amt_msat) {
      // paid just now
      this._isPaid = true
      payment.payment_route.total_fees =
        +payment.payment_route.total_fees +
        Math.floor(+payment.payment_route.total_amt * intraHubFee)
      if (this._bolt11) payment.pay_req = this._bolt11
      if (this._decoded) payment.decoded = this._decoded
    }

    if (payment.payment_error && payment.payment_error.indexOf('already paid') !== -1) {
      // already paid
      this._isPaid = true
      if (this._decoded) {
        payment.decoded = this._decoded
        if (this._bolt11) payment.pay_req = this._bolt11
        // trying to guess the fee
        payment.payment_route = payment.payment_route || {}
        // we dont know the exact fee, so we use max (same as fee_limit)
        payment.payment_route.total_fees = Math.floor(
          this._decoded.num_satoshis * forwardReserveFee
        )
        payment.payment_route.total_amt = this._decoded.num_satoshis
      }
    }

    if (payment.payment_error && payment.payment_error.indexOf('unable to') !== -1) {
      // failed to pay
      this._isPaid = false
    }

    if (payment.payment_error && payment.payment_error.indexOf('FinalExpiryTooSoon') !== -1) {
      this._isPaid = false
    }

    if (payment.payment_error && payment.payment_error.indexOf('UnknownPaymentHash') !== -1) {
      this._isPaid = false
    }

    if (
      payment.payment_error &&
      payment.payment_error.indexOf('IncorrectOrUnknownPaymentDetails') !== -1
    ) {
      this._isPaid = false
    }

    if (payment.payment_error && payment.payment_error.indexOf('payment is in transition') !== -1) {
      this._isPaid = null // null is default, but lets set it anyway
    }

    return payment
  }

  /**
   * Returns NULL if unknown, true if its paid, false if its unpaid
   * (judging by error in sendPayment response)
   *
   * @returns {boolean|null}
   */
  getIsPaid() {
    return this._isPaid
  }

  async attemptPayToRoute() {
    let routes = await this.queryRoutes()
    // @ts-ignore
    return await this.sendToRouteSync(routes.routes)
  }

  async listPayments() {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      this._lightning.listPayments({}, function (err, response) {
        if (err) return reject(err)
        resolve(response)
      })
    })
  }

  async isExpired() {
    if (!this._bolt11) throw new Error('bolt11 is not provided')
    const decoded = await this.decodePayReqViaRpc(this._bolt11)
    // @ts-ignore
    return +decoded.timestamp + +decoded.expiry < +new Date() / 1000
  }

  decodePayReqLocally(payReq) {
    // @ts-ignore
    this._decoded_locally = lightningPayReq.decode(payReq)
  }

  async getPaymentHash() {
    if (!this._bolt11) throw new Error('bolt11 is not provided')
    if (!this._decoded) await this.decodePayReqViaRpc(this._bolt11)

    return this._decoded['payment_hash']
  }
}

export default Paym
