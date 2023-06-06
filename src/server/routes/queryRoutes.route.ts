// ~~/src/server/routes/queryRoutes.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { promisify } from 'node:util'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/queryroutes', [request.uuid])
    let query = promisify(lightning.queryRoutes).bind(lightning)({
      pub_key: request.params.dest,
      use_mission_control: true,
      amt: request.params.amt,
      source_pub_key: request.params.source
    })
    .catch(console.error)
    return response.send(query)
  }
