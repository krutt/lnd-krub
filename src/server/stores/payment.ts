/* ~~/src/server/stores/payment.ts */

// imports
import type { MockPayment, Payment } from '@/types'
import { forwardReserveFee, intraHubFee } from '@/configs'
import { cache, lightning } from '@/server/stores'
import { decodePaymentRequest } from '@/server/stores/invoice'
import { promisify } from 'node:util'

/**
 *
 * @returns
 */
export const attemptPayToRoute = async (bolt11: string) => {
  let routes = await queryRoutes(bolt11)
  return await sendToRouteSync(bolt11, routes.routes)
}

/**
 * Retrieves amount paid per payment from paymentHash specified from solid-state cache
 * @returns {Number}
 */
export const fetchPaymentAmountPaid = async (paymentHash: string): Promise<number> => {
  return parseInt(await cache.get('ispaid_' + paymentHash))
}

/**
 *
 * @returns
 */
export const getPaymentHash = async (bolt11: string): Promise<string> => {
  let decoded = await decodePaymentRequest(bolt11)
  return decoded['payment_hash']
}

/**
 *
 * @returns
 */
export const isExpired = async (bolt11: string): Promise<boolean> => {
  let decoded = await decodePaymentRequest(bolt11)
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
export const processSendPaymentResponse = (payment: Payment, bolt11: string) => {
  if (payment.payment_error) {
    // something
  } else if (payment && payment.payment_route && payment.payment_route.total_amt_msat) {
    payment.payment_route.total_fees =
      +payment.payment_route.total_fees + Math.floor(+payment.payment_route.total_amt * intraHubFee)
    if (bolt11) payment.pay_req = bolt11
  }
  return payment
}

/**
 *
 * @returns
 */
export const queryRoutes = async (bolt11: string): Promise<any> => {
  let decoded = await decodePaymentRequest(bolt11)
  return await promisify(lightning.queryRoutes)
    .bind(lightning)({
      amt: decoded?.num_satoshis,
      fee_limit: { fixed: Math.floor(+decoded?.num_satoshis * forwardReserveFee) + 1 },
      final_cltv_delta: 144,
      pub_key: decoded?.destination,
    })
    .catch(console.error)
}

export const savePayment = async (
  payment: MockPayment | Payment,
  userId: string
): Promise<number> => await cache.rpush('txs_for_' + userId, JSON.stringify(payment))

export const sendPayment = async (
  amount: number,
  fee: number,
  bolt11: string
): Promise<Payment | null> =>
  await promisify(lightning.sendPaymentSync)
    .bind(lightning)({
      // allow_self_payment: true,
      payment_request: bolt11,
      amt: amount, // amt is used only for 'tip' invoices
      fee_limit: { fixed: fee },
      // timeout_seconds: 60
    })
    .catch(console.error)

/**
 *
 * @param routes
 */
export const sendToRouteSync = async (bolt11: string, routes) => {
  let decoded = await decodePaymentRequest(bolt11)
  let request = {
    payment_hash_string: decoded?.payment_hash,
    route: routes[0],
  }
  console.log('sendToRouteSync:', { request })
  let route = await promisify(lightning.sendToRouteSync)
    .bind(lightning)(request)
    .catch(console.error)
  if (route) processSendPaymentResponse(route, bolt11)
}

/**
 * Sets settled amount per payment by specified paymentHash on solid-state cache
 * @param {String} paymentHash
 * @param {Number} settleAmount
 * @returns {String}
 */
export const setPaymentAmountPaid = async (
  paymentHash: string,
  settleAmount: number
): Promise<'OK'> => await cache.set('ispaid_' + paymentHash, settleAmount)
