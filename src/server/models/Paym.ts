// ~~/src/server/models/Paym.ts

// imports
import type { LightningService } from '@/server/services/lightning'
import type { Payment } from '@/types'
import type { Redis as RedisService } from 'ioredis'
import bolt11, { PaymentRequestObject, TagsObject } from 'bolt11'
import { forwardReserveFee, intraHubFee } from '@/configs'
import { promisify } from 'node:util'

export class Paym {
  _lightning: LightningService
  _redis: RedisService
  _decoded?: {
    description: string
    destination: string
    expiry: number
    num_satoshis: number
    payment_hash: string
    timestamp: number
  }
  _decodedLocally?: PaymentRequestObject & TagsObject
  _isPaid?: boolean
  _paymentRequest?: string

  /**
   *
   * @param {LightningService} lightning
   * @param {RedisService} redis
   */
  constructor(lightning?: LightningService, redis?: RedisService) {
    this._lightning = lightning
    this._redis = redis
  }

  // methods

  /**
   *
   * @returns
   */
  attemptPayToRoute = async () => {
    let routes = await this.queryRoutes()
    return await this.sendToRouteSync(routes.routes)
  }

  /**
   * Decode given payment request string using 'bolt11' library
   * @param paymentRequest
   */
  decodePayReqLocally = (paymentRequest: string): PaymentRequestObject & TagsObject => {
    this._decodedLocally = bolt11.decode(paymentRequest)
    return this._decodedLocally
  }

  /**
   * Decode given payment request string using service denoded by rpc-endpoint
   * @param invoice
   * @returns
   */
  decodePayReqViaRpc = async (paymentRequest: string): Promise<any | null> => {
    this._decoded = await promisify(this._lightning.decodePayReq)
      .bind(this._lightning)({ pay_req: paymentRequest })
      .catch(console.error)
    return this._decoded
  }

  /**
   * Returns NULL if unknown, true if its paid, false if its unpaid
   * (judging by error in sendPaymentSync response)
   *
   * @returns {boolean | null}
   */
  getIsPaid = (): boolean | null => {
    return this._isPaid
  }

  /**
   *
   * @returns
   */
  getPaymentHash = async (): Promise<string> => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    if (!this._decoded) await this.decodePayReqViaRpc(this._paymentRequest)
    return this._decoded['payment_hash']
  }

  /**
   *
   * @returns
   */
  isExpired = async (): Promise<boolean> => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    let decoded = await this.decodePayReqViaRpc(this._paymentRequest)
    return +decoded.timestamp + +decoded.expiry < +new Date() / 1000
  }

  /**
   *
   * @returns
   */
  listPayments = async (): Promise<Array<Payment>> => {
    return await promisify(this._lightning.listPayments)
      .bind(this._lightning)({})
      .catch(err => {
        console.error(err)
        return []
      })
  }

  /**
   *
   * @param payment
   * @returns
   */
  processSendPaymentResponse = (payment: Payment) => {
    if (payment.payment_error) {
      if (payment.payment_error.indexOf('already paid') !== -1) {
        // already paid
        this._isPaid = true
        if (this._decoded) {
          payment.decoded = this._decoded
          if (this._paymentRequest) payment.pay_req = this._paymentRequest
          // trying to guess the fee
          payment.payment_route = payment.payment_route || {}
          // we dont know the exact fee, so we use max (same as fee_limit)
          payment.payment_route.total_fees = Math.floor(
            this._decoded.num_satoshis * forwardReserveFee
          )
          payment.payment_route.total_amt = this._decoded.num_satoshis
        }
      } else if (payment.payment_error.indexOf('unable to') !== -1) {
        // failed to pay
        this._isPaid = false
      } else if (payment.payment_error.indexOf('FinalExpiryTooSoon') !== -1) {
        this._isPaid = false
      } else if (payment.payment_error.indexOf('UnknownPaymentHash') !== -1) {
        this._isPaid = false
      } else if (payment.payment_error.indexOf('IncorrectOrUnknownPaymentDetails') !== -1) {
        this._isPaid = false
      } else if (payment.payment_error.indexOf('payment is in transition') !== -1) {
        this._isPaid = null // null is default, but lets set it anyway
      }
    } else if (payment && payment.payment_route && payment.payment_route.total_amt_msat) {
      // paid just now
      this._isPaid = true
      payment.payment_route.total_fees =
        +payment.payment_route.total_fees +
        Math.floor(+payment.payment_route.total_amt * intraHubFee)
      if (this._paymentRequest) payment.pay_req = this._paymentRequest
      if (this._decoded) payment.decoded = this._decoded
    }
    return payment
  }

  /**
   *
   * @returns
   */
  queryRoutes = async (): Promise<any> => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    if (!this._decoded) await this.decodePayReqViaRpc(this._paymentRequest)
    return await promisify(this._lightning.queryRoutes)
      .bind(this._lightning)({
        amt: this._decoded.num_satoshis,
        fee_limit: { fixed: Math.floor(this._decoded.num_satoshis * forwardReserveFee) + 1 },
        final_cltv_delta: 144,
        pub_key: this._decoded.destination,
      })
      .catch(console.error)
  }

  /**
   *
   * @param routes
   */
  sendToRouteSync = async routes => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    if (!this._decoded) await this.decodePayReqViaRpc(this._paymentRequest)
    let request = {
      payment_hash_string: this._decoded.payment_hash,
      route: routes[0],
    }
    console.log('sendToRouteSync:', { request })
    let route = await promisify(this._lightning.sendToRouteSync)
      .bind(this._lightning)(request)
      .catch(console.error)
    if (route) this.processSendPaymentResponse(route)
  }

  /**
   *
   * @param {string} paymentRequest
   */
  setPaymentRequest = (paymentRequest: string) => {
    this._paymentRequest = paymentRequest
  }
}

export default Paym
