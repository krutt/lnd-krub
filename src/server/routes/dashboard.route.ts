// ~~/src/server/routes/dashboard.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorLnd } from '@/server/exceptions'
import { listChannels } from '@/server/models/channel'
import { loadNodeInformation } from '@/server/models/dashblob'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/dashboard', [request.uuid])
    let result = await Promise.all([loadNodeInformation(), listChannels()]).catch(() =>
      errorLnd(response)
    )
    return response.send(result)
  }
