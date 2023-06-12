// ~~/src/server/routes/checkRouteInvoice.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis as RedisService } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorGeneralServerError, errorNotAValidInvoice } from '@/server/exceptions'
import { promisify } from 'node:util'

export default (
    bitcoin: BitcoinService,
    lightning: LightningService,
    redis: RedisService
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/checkrouteinvoice', [request.uuid])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }

    if (!request.query.invoice) return errorGeneralServerError(response)

    try {
      // at the momment does nothing.
      // TODO: decode and query actual route to destination
      let info = promisify(lightning.decodePayReq).bind(lightning)({
        pay_req: request.query.invoice,
      })
      return response.send(info)
    } catch (err) {
      return errorNotAValidInvoice(response)
    }
  }
