// ~~/src/server/routes/queryRoutes.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param request
   * @param response
   */
  async (request: LNDKrubRequest, response: Response) => {
    console.log('/queryroutes', [request.uuid])

    let query = {
      pub_key: request.params.dest,
      use_mission_control: true,
      amt: request.params.amt,
      source_pub_key: request.params.source,
    }
    lightning.queryRoutes(query, function (err, info) {
      console.log(JSON.stringify(info, null, 2))
      response.send(info)
    })
  }
