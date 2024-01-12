/* ~~/src/server/routes/chainInfo.route.ts */

// imports
import type { Request, Response } from 'express'
import { describeLightningGraph } from '@/server/stores/graph'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: Request, response: Response): Promise<Response> => {
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

export default route
