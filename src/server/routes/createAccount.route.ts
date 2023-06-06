// ~~/src/server/routes/createAccount.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadArguments, errorSunset } from '@/server/exceptions'
import { sunset } from '@/configs'

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
    console.log('/create', [request.uuid])
    // Valid if the partnerid isn't there or is a string (same with accounttype)
    if (
      !(
        (!request.body.partnerid ||
          typeof request.body.partnerid === 'string' ||
          request.body.partnerid instanceof String) &&
        (!request.body.accounttype ||
          typeof request.body.accounttype === 'string' ||
          request.body.accounttype instanceof String)
      )
    )
      return errorBadArguments(response)
    if (sunset) return errorSunset(response)
    let user = new User(bitcoin, lightning, redis)
    await user.create()
    await user.saveMetadata({
      partnerid: request.body.partnerid,
      accounttype: request.body.accounttype,
      created_at: new Date().toISOString(),
    })
    return response.send({ login: user.getLogin(), password: user.getPassword() })
  }
