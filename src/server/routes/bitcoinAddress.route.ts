// ~~/src/server/routes/bitcoinAddress.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { CacheService } from '@/server/services/cache'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorSunsetAddInvoice } from '@/server/exceptions'
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
    console.log('/getbtc', [request.uuid])
    let user = new User(bitcoin, cache, lightning)
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
