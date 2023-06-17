// ~~/src/server/routes/checkRouteInvoice.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { decodePaymentRequest } from '@/server/models/invoice'
import { errorBadAuth, errorGeneralServerError, errorNotAValidInvoice } from '@/server/exceptions'
import { loadUserByAuthorization } from '@/server/models/user'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/checkrouteinvoice', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) {
      return errorBadAuth(response)
    }

    let paymentRequest = request.query.invoice || request.query.payment_request
    if (!paymentRequest) return errorGeneralServerError(response)

    // at the momment does nothing.
    // TODO: decode and query actual route to destination
    let info = await decodePaymentRequest(paymentRequest.toString())
    if (!info) return errorNotAValidInvoice(response)
    return response.send(info)
  }
