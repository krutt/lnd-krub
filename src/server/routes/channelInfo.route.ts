// ~~/src/server/routes/chainInfo.route.ts

// imports
import { Graph } from '@/server/models/Graph'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis as RedisService } from 'ioredis'
import type { Response } from 'express'

export default (lightning: LightningService, redis: RedisService): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
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
