/* ~~/src/server/routes/channels.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth, errorLnd } from '@/server/exceptions'
import { loadUserIdByAuthorization } from '@/server/stores/user'
import { listChannels } from '@/server/stores/channel'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {)
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  let channels = await listChannels()
  if (!channels) return errorLnd(response)
  return response.send({ channels })
}

export default route
