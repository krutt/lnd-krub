/* ~~/src/server/routes/balance.route.ts */

// imports
import type { Request, Response } from 'express'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import {
  calculateBalance,
  generateUserAddress,
  getUserAddress,
  loadUserIdByAuthorization,
} from '@/server/stores/user'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: Request, response: Response): Promise<Response> => {
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  if (!(await getUserAddress(userId))) await generateUserAddress(userId) // onchain address needed further
  return await calculateBalance(userId)
    .then(balance => response.send({ BTC: { AvailableBalance: Math.max(balance, 0) } }))
    .catch(err => {
      console.error('', ['error getting balance:', err, 'userid:', userId])
      return errorGeneralServerError(response)
    })
}

export default route
