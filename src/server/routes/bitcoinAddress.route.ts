// ~~/src/server/routes/bitcoinAddress.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorSunsetAddInvoice } from '@/server/exceptions'
import { sunset } from '@/configs'

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
    console.log('/getbtc', [request.uuid])
    let user = new User(bitcoin, lightning, redis)
    await user.loadByAuthorization(request.headers.authorization)
    if (!user.getUserId()) return errorBadAuth(response)
    if (sunset) return errorSunsetAddInvoice(response)
    let address = await user.getAddress()
    if (!address) {
      await user.generateAddress()
      address = await user.getAddress()
    }
    user.watchAddress(address)
    return response.send([{ address }])
  }
