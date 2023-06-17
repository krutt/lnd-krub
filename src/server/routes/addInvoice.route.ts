// ~~/src/server/routes/addInvoice.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import {
  errorBadAuth,
  errorBadArguments,
  errorLnd,
  errorSunsetAddInvoice,
} from '@/server/exceptions'
import { loadUserByAuthorization, saveUserInvoice } from '@/server/models/user'
import { createInvoice, savePreimage } from '@/server/models/invoice'
import { randomBytes } from 'node:crypto'
import { sunset } from '@/configs'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/addinvoice', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)
    console.log('/addinvoice', [request.uuid, 'userid: ' + userId])

    if (!request.body.amt || /*stupid NaN*/ !(request.body.amt > 0))
      return errorBadArguments(response)

    if (sunset) return errorSunsetAddInvoice(response)
    let r_preimage: string = randomBytes(32).toString('base64')
    let invoice = await createInvoice(request.body.amt, request.body.memo, r_preimage)
    if (!invoice) return errorLnd(response)
    invoice.pay_req = invoice.payment_request // bluewallet: client backwards compatibility
    await saveUserInvoice(invoice, userId)
    await savePreimage(r_preimage)
    return response.send(invoice)
  }
