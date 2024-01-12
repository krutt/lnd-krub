/* ~~/src/server/routes/faucet.route.ts */

// imports
import type { Request, Response } from 'express'
import { calculateBalance, clearBalanceCache } from '@/server/stores/user'
import { createInvoice } from '@/server/stores/invoice'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import { loadUserIdByAuthorization, saveUserInvoice } from '@/server/stores/user'
import { markAsPaidInDatabase, savePreimage } from '@/server/stores/invoice'
import { savePayment } from '@/server/stores/payment'
import { randomBytes } from 'node:crypto'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: Request, response: Response): Promise<Response> => {
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)

  let amount = parseInt(request.body.amt || request.body.amount || 0)
  if (amount) {
    let r_preimage = randomBytes(32).toString('base64')
    let invoice = await createInvoice(amount, 'faucet', r_preimage)
    if (!invoice) return errorGeneralServerError(response)
    // TODO: parallelize
    await saveUserInvoice(invoice, userId)
    await savePreimage(r_preimage)
    await clearBalanceCache(userId)
    await savePayment(
      {
        decoded: {
          timestamp: Math.floor(+new Date() / 1000),
        },
        fee: 0,
        memo: 'faucet',
        pay_req: invoice.payment_request,
        type: 'faucet',
        value: amount,
      },
      'faucet'
    )
    await markAsPaidInDatabase(invoice.payment_request)
  }
  let balance = await calculateBalance(userId)
  return response.send({ balance })
}

export default route
