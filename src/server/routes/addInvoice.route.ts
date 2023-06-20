/* ~~/src/server/routes/addInvoice.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import {
  errorBadAuth,
  errorBadArguments,
  errorLnd,
  errorSunsetAddInvoice,
} from '@/server/exceptions'
import { loadUserIdByAuthorization, saveUserInvoice } from '@/server/stores/user'
import { createInvoice, savePreimage } from '@/server/stores/invoice'
import { randomBytes } from 'node:crypto'
import { sunset } from '@/configs'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/addinvoice', [request.uuid])
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  console.log('/addinvoice', [request.uuid, 'userid: ' + userId])

  if (!request.body.amt || /*stupid NaN*/ !(request.body.amt > 0))
    return errorBadArguments(response)

  if (sunset) return errorSunsetAddInvoice(response)
  let r_preimage: string = randomBytes(32).toString('base64')
  let invoiceResponse = await createInvoice(request.body.amt, request.body.memo, r_preimage)
  if (!invoiceResponse) return errorLnd(response)
  invoiceResponse.pay_req = invoiceResponse.payment_request // bluewallet: client backwards compatibility
  // TODO: parallelize
  await saveUserInvoice(invoiceResponse, userId)
  await savePreimage(r_preimage)
  return response.send(invoiceResponse)
}

export default route
