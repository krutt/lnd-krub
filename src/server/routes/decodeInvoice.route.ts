// ~~/src/server/routes/decodeInvoice.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorGeneralServerError, errorNotAValidInvoice } from '@/server/exceptions'
import { promisify } from 'node:util'

export default (
    bitcoin: BitcoinService,
    lightning: LightningService,
    redis: Redis
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param request
   * @param response
   * @returns
   */
  async (request: LNDKrubRequest, response: Response) => {
    console.log('/decodeinvoice', [request.uuid])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }

    if (!request.query.invoice) return errorGeneralServerError(response)

    try {
      let info = await promisify(lightning.decodePayReq).bind(lightning)({
        pay_req: request.query.invoice,
      })
      return response.send(info)
    } catch (err) {
      return errorNotAValidInvoice(response)
    }
  }
