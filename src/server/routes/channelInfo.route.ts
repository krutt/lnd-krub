// ~~/src/server/routes/chainInfo.route.ts

// imports
import { Graph } from '@/server/models/Graph'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'

export default (lightning: LightningService, redis: Redis): LNDKrubRouteFunc =>
  /**
   *
   * @param request
   * @param response
   * @returns
   */
  async (request: LNDKrubRequest, response: Response) => {
    console.log('/getchaninfo', [request.uuid])
    let graph = new Graph(lightning, redis)
    let { edges } = await graph.describe()
    if (!!edges) {
      for (let edge of edges) {
        if (edge.channel_id === request.params.channelId) {
          return response.send(edge)
        }
      }
    }
    return response.send('')
  }
