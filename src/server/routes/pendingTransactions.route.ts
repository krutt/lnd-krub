/* ~~/src/server/routes/pendingTransactions.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import {
  generateUserAddress,
  getPendingTransactions,
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
  console.log('/getpending', [request.uuid])
  let userId = await loadUserByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  console.log('/getpending', [request.uuid, 'userid: ' + userId])
  if (!(await getUserAddress(userId))) await generateUserAddress(userId) // onchain address needed further
  return response.send(await getPendingTransactions(userId))
}

export default route
