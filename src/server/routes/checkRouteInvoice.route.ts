/* ~~/src/server/routes/checkRouteInvoice.route.ts */

// imports
import type { Request, Response } from 'express'
import { decodePaymentRequest } from '@/server/stores/invoice'
import { errorBadAuth, errorGeneralServerError, errorNotAValidInvoice } from '@/server/exceptions'
import { loadUserIdByAuthorization } from '@/server/stores/user'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: Request, response: Response): Promise<Response> => {
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  let bolt11 = request.query.invoice
  if (!bolt11) return errorGeneralServerError(response)
  // at the momment does nothing.
  // TODO: decode and query actual route to destination
  let info = await decodePaymentRequest(bolt11.toString())
  if (!info) return errorNotAValidInvoice(response)
  return response.send(info)
}

export default route
