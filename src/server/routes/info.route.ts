/* ~~/src/server/routes/info.route.ts */

// imports
import type { Request, Response } from 'express'
import { errorBadAuth, errorLnd } from '@/server/exceptions'
import { loadNodeInformation } from '@/server/stores/dashblob'
import { loadUserIdByAuthorization } from '@/server/stores/user'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: Request, response: Response): Promise<Response> => {
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  let dashblob = await loadNodeInformation()
  if (!dashblob) return errorLnd(response)
  return response.send(dashblob)
}

export default route
