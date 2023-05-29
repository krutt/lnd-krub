// ~~/src/server/routes/info.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorLnd } from '@/server/exceptions'
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
    console.log('/getinfo', [request.id])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    return await promisify(lightning.getInfo)
      .bind(lightning)({})
      .then(info => response.send(info))
      .catch(() => errorLnd(response))
  }
