/* ~~/src/server/routes/balance.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import {
  calculateBalance,
  generateUserAddress,
  getUserAddress,
  loadUserByAuthorization,
} from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/balance', [request.uuid])
  let userId = await loadUserByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  console.log('/balance', [request.uuid, 'userid: ' + userId])
  if (!(await getUserAddress(userId))) await generateUserAddress(userId) // onchain address needed further
  return await calculateBalance(userId)
    .then(balance => response.send({ BTC: { AvailableBalance: Math.max(balance, 0) } }))
    .catch(err => {
      console.error('', [request.uuid, 'error getting balance:', err, 'userid:', userId])
      return errorGeneralServerError(response)
    })
}

export default route
