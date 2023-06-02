// ~~/src/server/routes/authenticate.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorBadArguments } from '@/server/exceptions'

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
    console.log('/auth', [request.uuid])
    if (!((request.body.login && request.body.password) || request.body.refresh_token))
      return errorBadArguments(response)
    let user = new User(bitcoin, lightning, redis)
    if (request.body.refresh_token) {
      // need to refresh token
      if (await user.loadByRefreshToken(request.body.refresh_token)) {
        return response.send({
          refresh_token: user.getRefreshToken(),
          access_token: user.getAccessToken(),
        })
      } else {
        return errorBadAuth(response)
      }
    } else {
      // need to authorize user
      let result = await user.loadByLoginAndPassword(request.body.login, request.body.password)
      if (result) {
        return response.send({
          refresh_token: user.getRefreshToken(),
          access_token: user.getAccessToken(),
        })
      } else return errorBadAuth(response)
    }
  }
