/* ~~/src/server/routes/userInvoices.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import { getUserInvoices, loadUserIdByAuthorization } from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {)
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)
  let limit: string = request.query.limit?.toString() || '0'
  return await getUserInvoices(userId, parseInt(limit))
    .then(invoices => response.send(invoices))
    .catch(err => {
      let { message }: { message?: string } = err
      console.error('', [request.uuid, 'error getting user invoices:', message, 'userid:', userId])
      return response.send([])
    })
}

export default route
