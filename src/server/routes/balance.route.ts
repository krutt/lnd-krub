// ~~/src/server/routes/balance.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import {
  calculateBalance,
  generateUserAddress,
  getUserAddress,
  loadUserByAuthorization,
} from '@/server/models/user'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/balance', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)
    console.log('/balance', [request.uuid, 'userid: ' + userId])
    if (!(await getUserAddress(userId))) await generateUserAddress(userId) // onchain address needed further
    try {
      let balance = await calculateBalance(userId)
      if (balance < 0) balance = 0
      return response.send({ BTC: { AvailableBalance: balance } })
    } catch (err) {
      console.error('', [request.uuid, 'error getting balance:', err, 'userid:', userId])
      return errorGeneralServerError(response)
    }
  }
