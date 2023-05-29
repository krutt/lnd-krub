// ~~/src/server/routes/info.route.ts

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
    console.log('/getinfo', [request.id])
    return await promisify(lightning.getInfo)
      .bind(lightning)({})
      .then(info => response.send(info))
      .catch(() => errorLnd(response))
  }
