// ~~/src/server/routes/channels.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { errorBadAuth, errorLnd } from '@/server/exceptions'
import { promisify } from 'node:util'
import { loadUserByAuthorization } from '@/server/models/user'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/channels', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) {
      return errorBadAuth(response)
    }
    return await promisify(lightning.listChannels)
      .bind(lightning)({})
      .then(result => response.send(result))
      .catch(err => {
        console.error(err)
        return errorLnd(response)
      })
  }
