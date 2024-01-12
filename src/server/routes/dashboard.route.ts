/* ~~/src/server/routes/dashboard.route.ts */

// imports
import type { Request, Response } from 'express'
import { errorLnd } from '@/server/exceptions'
import { listChannels } from '@/server/stores/channel'
import { loadNodeInformation } from '@/server/stores/dashblob'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (_: Request, response: Response): Promise<Response> => {
  return await Promise.all([loadNodeInformation(), listChannels()])
    .then(results => response.send(results))
    .catch(() => errorLnd(response))
}

export default route
