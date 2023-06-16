// ~~/src/server/routes/addInvoice.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { CacheService } from '@/server/services/cache'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import { Invo } from '@/server/models/Invo'
import { User } from '@/server/models/User'
import { Invoice } from '@/types'
import type { Response } from 'express'
import {
  errorBadAuth,
  errorBadArguments,
  errorLnd,
  errorSunsetAddInvoice,
} from '@/server/exceptions'
import { promisify } from 'node:util'
import { sunset } from '@/configs'

export default (
    bitcoin: BitcoinService,
    cache: CacheService,
    lightning: LightningService
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/addinvoice', [request.uuid])
    let user = new User(bitcoin, cache, lightning)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    console.log('/addinvoice', [request.uuid, 'userid: ' + user.getUserId()])

    if (!request.body.amt || /*stupid NaN*/ !(request.body.amt > 0))
      return errorBadArguments(response)

    if (sunset) return errorSunsetAddInvoice(response)
    const invoice = new Invo(cache, lightning)
    const r_preimage = invoice.makePreimageHex()
    return await promisify(lightning.addInvoice)
      .bind(lightning)({
        memo: request.body.memo,
        value: request.body.amt,
        expiry: 3600 * 24,
        r_preimage: Buffer.from(r_preimage, 'hex').toString('base64'),
      })
      .then(async (info: Invoice) => {
        info.pay_req = info.payment_request // bluewallet: client backwards compatibility
        await user.saveUserInvoice(info)
        await invoice.savePreimage(r_preimage)
        return response.send(info)
      })
      .catch(err => {
        console.error(err)
        return errorLnd(response)
      })
  }
