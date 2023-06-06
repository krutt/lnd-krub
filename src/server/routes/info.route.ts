// ~~/src/server/routes/info.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
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
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/getinfo', [request.uuid])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    return await promisify(lightning.getInfo)
      .bind(lightning)({})
      .then(info => response.send(info))
      .catch(() => errorLnd(response))
  }
