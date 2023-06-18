// ~~/src/server/routes/faucet.route.ts

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { calculateBalance, clearBalanceCache } from '@/server/stores/user'
import { createInvoice } from '@/server/stores/invoice'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import { loadUserByAuthorization, savePaidLndInvoice, saveUserInvoice } from '@/server/stores/user'
import { markAsPaidInDatabase, savePreimage } from '@/server/stores/invoice'
import { randomBytes } from 'node:crypto'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/faucet', [request.uuid])
  let userId = await loadUserByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)

  let amount = parseInt(request.body.amt || request.body.amount || 0)
  if (amount) {
    let r_preimage = randomBytes(32).toString('base64')
    let invoice = await createInvoice(amount, 'faucet', r_preimage)
    if (!invoice) return errorGeneralServerError(response)
    await saveUserInvoice(invoice, userId)
    await savePreimage(r_preimage)
    await clearBalanceCache(userId)
    await savePaidLndInvoice(
      {
        timestamp: Math.floor(+new Date() / 1000),
        type: 'faucet',
        value: amount,
        fee: 0,
        memo: 'faucet',
        pay_req: invoice.payment_request,
      },
      'faucet'
    )
    await markAsPaidInDatabase(invoice.payment_request)
  }
  let balance = await calculateBalance(userId)
  return response.send({ balance })
}

export default route
