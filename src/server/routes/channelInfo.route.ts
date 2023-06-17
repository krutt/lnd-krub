// ~~/src/server/routes/chainInfo.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { describeLightningGraph } from '@/server/models/_graph'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/getchaninfo', [request.uuid])
    let { edges } = await describeLightningGraph()
    if (!!edges) {
      for (let edge of edges) {
        if (edge.channel_id === request.params.channelId) {
          return response.send(edge)
        }
      }
    }
    return response.send('')
  }
