// ~~/src/server/routes/checkPayment.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import { getPaymentHashPaid, loadUserByAuthorization, syncInvoicePaid } from '@/server/models/user'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/checkpayment', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)
    let paid: boolean = true
    let paymentHash: string = request.params.payment_hash
    if (!(await getPaymentHashPaid(paymentHash))) {
      // Not found on cache
      paid = await syncInvoicePaid(paymentHash, userId)
    }
    return response.send({ paid })
  }
