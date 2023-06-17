// ~~/src/server/routes/addInvoice.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import { Invoice } from '@/types'
import type { Response } from 'express'
import {
  errorBadAuth,
  errorBadArguments,
  errorLnd,
  errorSunsetAddInvoice,
} from '@/server/exceptions'
import { loadUserByAuthorization, saveUserInvoice } from '@/server/models/user'
import { makePreimageHex, savePreimage } from '@/server/models/invoice'
import { promisify } from 'node:util'
import { sunset } from '@/configs'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/addinvoice', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) {
      return errorBadAuth(response)
    }
    console.log('/addinvoice', [request.uuid, 'userid: ' + userId])

    if (!request.body.amt || /*stupid NaN*/ !(request.body.amt > 0))
      return errorBadArguments(response)

    if (sunset) return errorSunsetAddInvoice(response)
    let r_preimage = makePreimageHex()
    return await promisify(lightning.addInvoice)
      .bind(lightning)({
        memo: request.body.memo,
        value: request.body.amt,
        expiry: 3600 * 24,
        r_preimage: Buffer.from(r_preimage, 'hex').toString('base64'),
      })
      .then(async (info: Invoice) => {
        info.pay_req = info.payment_request // bluewallet: client backwards compatibility
        await saveUserInvoice(info, userId)
        await savePreimage(r_preimage)
        return response.send(info)
      })
      .catch(err => {
        console.error(err)
        return errorLnd(response)
      })
  }
