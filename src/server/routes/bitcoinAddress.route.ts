// ~~/src/server/routes/bitcoinAddress.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorBadAuth, errorSunsetAddInvoice } from '@/server/exceptions'
import { sunset } from '@/configs'
import {
  loadUserByAuthorization,
  generateUserAddress,
  getUserAddress,
  watchAddress,
} from '@/server/models/_user'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/getbtc', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) {
      return errorBadAuth(response)
    }
    if (sunset) return errorSunsetAddInvoice(response)
    let address = await getUserAddress(userId)
    if (!address) await generateUserAddress(userId)
    address = await getUserAddress(userId)
    /*await */ watchAddress(address)
    return response.send([{ address }])
  }
