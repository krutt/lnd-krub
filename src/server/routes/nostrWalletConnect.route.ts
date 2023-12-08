/* ~~/src/server/routes/nostrWalletConnect.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import { randomBytes } from 'node:crypto'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/nwc', [request.uuid])
  let { pubkey } = request.body
  let relay: string = 'wss://localhost:7000'  // TODO: tentative
  if (!pubkey) return errorBadAuth(response)
  console.log(pubkey)
  let secret: string = randomBytes(32).toString('base64')
  let connection: string = `nostr+walletconnect:${pubkey}`
  connection += `?relay=${encodeURIComponent(relay)}`
  connection += `&secret=${secret}`
  return response.send({ connection })
}

export default route
