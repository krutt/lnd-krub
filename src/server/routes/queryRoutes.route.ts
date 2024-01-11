/* ~~/src/server/routes/queryRoutes.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadArguments, errorLnd } from '@/server/exceptions'
import { queryRoutes } from '@/server/stores/route'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  let amount: number = parseInt(request.params.amt || request.params.amount || '0')
  let destination: string = request.params.dest || request.params.destination
  let source: string = request.params.source || request.params.src
  if (!amount || !destination || !source) return errorBadArguments(response)
  let routes = await queryRoutes(amount, destination, source)
  if (!routes) return errorLnd(response)
  return response.send(routes)
}

export default route
