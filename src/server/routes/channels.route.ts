// ~~/src/server/routes/channels.route.ts

// imports
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { errorLnd } from '@/server/exceptions'
import { promisify } from 'node:util'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param request
   * @param response
   * @returns
   */
  async (request: LNDKrubRequest, response: Response) => {
    console.log('/channels', [request.id])
    return await promisify(lightning.listChannels)
      .bind(lightning)({})
      .then(result => response.send(result))
      .catch(err => {
        console.error(err)
        return errorLnd(response)
      })
  }
