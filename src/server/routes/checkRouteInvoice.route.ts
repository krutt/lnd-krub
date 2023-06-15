// ~~/src/server/routes/checkRouteInvoice.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { CacheService } from '@/server/services/cache'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorGeneralServerError, errorNotAValidInvoice } from '@/server/exceptions'
import { promisify } from 'node:util'

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
    console.log('/checkrouteinvoice', [request.uuid])
    let user = new User(bitcoin, cache, lightning)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }

    let paymentRequest = request.query.invoice
    if (!paymentRequest) return errorGeneralServerError(response)

    // at the momment does nothing.
    // TODO: decode and query actual route to destination
    let info = await promisify(lightning.decodePayReq)
      .bind(lightning)({ pay_req: paymentRequest })
      .catch(console.error)
    if (!info) return errorNotAValidInvoice(response)
    return response.send(info)
  }
