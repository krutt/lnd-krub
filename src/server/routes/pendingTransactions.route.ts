/* ~~/src/server/routes/pendingTransactions.route.ts */

// imports
import type { Request, Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import {
  generateUserAddress,
  getPendingTransactions,
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
  return response.send(await getPendingTransactions(userId))
}

export default route
