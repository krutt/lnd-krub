/* ~~/src/server/routes/nostrWalletConnect.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
// import { errorBadAuth, errorLnd } from '@/server/exceptions'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/nwc', [request.uuid])

  // return response.send(dashblob)
}

export default route
