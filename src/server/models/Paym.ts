// ~~/src/server/models/Paym.ts

// imports
import type { LightningService } from '@/server/services/lightning'
import type { Payment } from '@/types'
import bolt11, { PaymentRequestObject, TagsObject } from 'bolt11'
import { forwardReserveFee, intraHubFee } from '@/configs'
import { promisify } from 'node:util'

export class Paym {
  decoded?: {
    description: string
    destination: string
    expiry: number
    num_satoshis: number
    payment_hash: string
    timestamp: number
  }
  decodedLocally?: PaymentRequestObject & TagsObject
  isPaid?: boolean
  lightning: LightningService
  paymentRequest?: string

  /**
   *
   * @param {LightningService} lightning
   */
  constructor(lightning: LightningService) {
    this.lightning = lightning
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
    this.decodedLocally = bolt11.decode(paymentRequest)
    return this.decodedLocally
  }

  /**
   * Decode given payment request string using service denoded by rpc-endpoint
   * @param invoice
   * @returns
   */
  decodePayReqViaRpc = async (paymentRequest: string): Promise<any | null> => {
    this.decoded = await promisify(this.lightning.decodePayReq)
      .bind(this.lightning)({ pay_req: paymentRequest })
      .catch(console.error)
    return this.decoded
  }

  /**
   * Returns NULL if unknown, true if its paid, false if its unpaid
   * (judging by error in sendPaymentSync response)
   *
   * @returns {boolean | null}
   */
  getIsPaid = (): boolean | null => {
    return this.isPaid
  }

  /**
   *
   * @returns
   */
  getPaymentHash = async (): Promise<string> => {
    if (!this.paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    if (!this.decoded) await this.decodePayReqViaRpc(this.paymentRequest)
    return this.decoded['payment_hash']
  }

  /**
   *
   * @returns
   */
  isExpired = async (): Promise<boolean> => {
    if (!this.paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    let decoded = await this.decodePayReqViaRpc(this.paymentRequest)
    return +decoded.timestamp + +decoded.expiry < +new Date() / 1000
  }

  /**
   *
   * @returns
   */
  listPayments = async (): Promise<Array<Payment>> => {
    return await promisify(this.lightning.listPayments)
      .bind(this.lightning)({})
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
        this.isPaid = true
        if (this.decoded) {
          payment.decoded = this.decoded
          if (this.paymentRequest) payment.pay_req = this.paymentRequest
          // trying to guess the fee
          payment.payment_route = payment.payment_route || {}
          // we dont know the exact fee, so we use max (same as fee_limit)
          payment.payment_route.total_fees = Math.floor(
            this.decoded.num_satoshis * forwardReserveFee
          )
          payment.payment_route.total_amt = this.decoded.num_satoshis
        }
      } else if (payment.payment_error.indexOf('unable to') !== -1) {
        // failed to pay
        this.isPaid = false
      } else if (payment.payment_error.indexOf('FinalExpiryTooSoon') !== -1) {
        this.isPaid = false
      } else if (payment.payment_error.indexOf('UnknownPaymentHash') !== -1) {
        this.isPaid = false
      } else if (payment.payment_error.indexOf('IncorrectOrUnknownPaymentDetails') !== -1) {
        this.isPaid = false
      } else if (payment.payment_error.indexOf('payment is in transition') !== -1) {
        this.isPaid = null // null is default, but lets set it anyway
      }
    } else if (payment && payment.payment_route && payment.payment_route.total_amt_msat) {
      // paid just now
      this.isPaid = true
      payment.payment_route.total_fees =
        +payment.payment_route.total_fees +
        Math.floor(+payment.payment_route.total_amt * intraHubFee)
      if (this.paymentRequest) payment.pay_req = this.paymentRequest
      if (this.decoded) payment.decoded = this.decoded
    }
    return payment
  }

  /**
   *
   * @returns
   */
  queryRoutes = async (): Promise<any> => {
    if (!this.paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    if (!this.decoded) await this.decodePayReqViaRpc(this.paymentRequest)
    return await promisify(this.lightning.queryRoutes)
      .bind(this.lightning)({
        amt: this.decoded.num_satoshis,
        fee_limit: { fixed: Math.floor(this.decoded.num_satoshis * forwardReserveFee) + 1 },
        final_cltv_delta: 144,
        pub_key: this.decoded.destination,
      })
      .catch(console.error)
  }

  /**
   *
   * @param routes
   */
  sendToRouteSync = async routes => {
    if (!this.paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    if (!this.decoded) await this.decodePayReqViaRpc(this.paymentRequest)
    let request = {
      payment_hash_string: this.decoded.payment_hash,
      route: routes[0],
    }
    console.log('sendToRouteSync:', { request })
    let route = await promisify(this.lightning.sendToRouteSync)
      .bind(this.lightning)(request)
      .catch(console.error)
    if (route) this.processSendPaymentResponse(route)
  }

  /**
   *
   * @param {string} paymentRequest
   */
  setPaymentRequest = (paymentRequest: string) => {
    this.paymentRequest = paymentRequest
  }
}

export default Paym
