/* ~~/src/server/routes/dashboard.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorLnd } from '@/server/exceptions'
import { listChannels } from '@/server/stores/channel'
import { loadNodeInformation } from '@/server/stores/dashblob'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  return await Promise.all([loadNodeInformation(), listChannels()])
    .then(results => response.send(results))
    .catch(() => errorLnd(response))
}

export default route
