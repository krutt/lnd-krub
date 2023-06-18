// ~~/src/server/routes/decodeInvoice.route.ts

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { decodePaymentRequest } from '@/server/stores/invoice'
import { errorBadAuth, errorGeneralServerError, errorNotAValidInvoice } from '@/server/exceptions'
import { loadUserByAuthorization } from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/decodeinvoice', [request.uuid])
  let userId = await loadUserByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  let paymentRequest = request.query.invoice || request.query.payment_request
  if (!paymentRequest) return errorGeneralServerError(response)
  let info = await decodePaymentRequest(paymentRequest.toString())
  if (!info) return errorNotAValidInvoice(response)
  return response.send(info)
}

export default route
