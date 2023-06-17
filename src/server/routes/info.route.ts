// ~~/src/server/routes/info.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { errorBadAuth, errorLnd } from '@/server/exceptions'
import { loadUserByAuthorization } from '@/server/models/user'
import { promisify } from 'node:util'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/getinfo', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)
    return await promisify(lightning.getInfo)
      .bind(lightning)({})
      .then(info => response.send(info))
      .catch(() => errorLnd(response))
  }
