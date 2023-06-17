// ~~/src/server/routes/channels.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorBadAuth, errorLnd } from '@/server/exceptions'
import { loadUserByAuthorization } from '@/server/models/user'
import { listChannels } from '@/server/models/channel'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/channels', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)
    let channels = await listChannels()
    if (!channels) return errorLnd(response)
    return response.send({ channels })
  }
