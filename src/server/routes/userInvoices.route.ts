// ~~/src/server/routes/userInvoices.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import { loadUserByAuthorization } from '@/server/models/user'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/getuserinvoices', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)
    console.log('/getuserinvoices', [request.uuid, 'userid: ' + userId])

    try {
      // @ts-ignore
      let invoices = await user.getUserInvoices(request.query.limit)
      return response.send(invoices)
    } catch (err: any) {
      let { message }: { message?: string } = err
      console.log('', [request.uuid, 'error getting user invoices:', message, 'userid:', userId])
      return response.send([])
    }
  }
