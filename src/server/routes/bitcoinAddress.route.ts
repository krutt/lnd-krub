/* ~~/src/server/routes/bitcoinAddress.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth, errorSunsetAddInvoice } from '@/server/exceptions'
import { sunset } from '@/configs'
import {
  loadUserIdByAuthorization,
  generateUserAddress,
  getUserAddress,
  watchAddress,
} from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
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

export default route
