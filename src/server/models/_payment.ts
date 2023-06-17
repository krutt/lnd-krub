// ~~/src/server/models/payment.ts

// imports
import type { Payment } from '@/types'
import bolt11, { PaymentRequestObject, TagsObject } from 'bolt11'
import { forwardReserveFee, intraHubFee } from '@/configs'
import { lightning } from '@/server/models'
import { promisify } from 'node:util'

/**
 *
 * @returns
 */
export const attemptPayToRoute = async (paymentRequest: string) => {
  let routes = await queryRoutes(paymentRequest)
  return await sendToRouteSync(paymentRequest, routes.routes)
}

/**
 * Decode given payment request string using 'bolt11' library
 * @param paymentRequest
 */
export const decodePayReqLocally = (paymentRequest: string): PaymentRequestObject & TagsObject => {
  return bolt11.decode(paymentRequest)
}

/**
 * Decode given payment request string using service denoded by rpc-endpoint
 * @param invoice
 * @returns
 */
export const decodePayReqViaRpc = async (paymentRequest: string): Promise<any | null> => {
  return await promisify(lightning.decodePayReq)
    .bind(lightning)({ pay_req: paymentRequest })
    .catch(console.error)
}

/**
 *
 * @returns
 */
export const getPaymentHash = async (paymentRequest: string): Promise<string> => {
  let decoded = await decodePayReqViaRpc(paymentRequest)
  return decoded['payment_hash']
}

/**
 *
 * @returns
 */
export const isExpired = async (paymentRequest: string): Promise<boolean> => {
  let decoded = await decodePayReqViaRpc(paymentRequest)
  return +decoded.timestamp + +decoded.expiry < +new Date() / 1000
}

/**
 *
 * @returns
 */
export const listPayments = async (): Promise<Array<Payment>> =>
  await promisify(lightning.listPayments)
    .bind(lightning)({})
    .catch(err => {
      console.error(err)
      return []
    })

/**
 *
 * @param payment
 * @returns
 */
export const processSendPaymentResponse = (payment: Payment, paymentRequest: string) => {
  if (payment.payment_error) {
    // something
  } else if (payment && payment.payment_route && payment.payment_route.total_amt_msat) {
    payment.payment_route.total_fees =
      +payment.payment_route.total_fees + Math.floor(+payment.payment_route.total_amt * intraHubFee)
    if (paymentRequest) payment.pay_req = paymentRequest
  }
  return payment
}

/**
 *
 * @returns
 */
export const queryRoutes = async (paymentRequest: string): Promise<any> => {
  let decoded = await decodePayReqViaRpc(paymentRequest)
  return await promisify(lightning.queryRoutes)
    .bind(lightning)({
      amt: decoded.num_satoshis,
      fee_limit: { fixed: Math.floor(decoded.num_satoshis * forwardReserveFee) + 1 },
      final_cltv_delta: 144,
      pub_key: decoded.destination,
    })
    .catch(console.error)
}

/**
 *
 * @param routes
 */
export const sendToRouteSync = async (paymentRequest: string, routes) => {
  let decoded = await decodePayReqViaRpc(paymentRequest)
  let request = {
    payment_hash_string: decoded.payment_hash,
    route: routes[0],
  }
  console.log('sendToRouteSync:', { request })
  let route = await promisify(lightning.sendToRouteSync)
    .bind(lightning)(request)
    .catch(console.error)
  if (route) processSendPaymentResponse(route, paymentRequest)
}
