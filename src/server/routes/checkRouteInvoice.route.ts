// ~~/src/server/routes/checkRouteInvoice.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
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
    console.log('/checkrouteinvoice', [request.id])
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
