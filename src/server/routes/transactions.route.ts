/* ~~/src/server/routes/transactions.route.ts */

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { Response } from 'express'
import { errorBadAuth } from '@/server/exceptions'
import { forwardReserveFee } from '@/configs'
import {
  generateUserAddress,
  getLockedPayments,
  getTransactions,
  getUserAddress,
  loadUserIdByAuthorization,
} from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  let userId = await loadUserIdByAuthorization(request.headers.authorization)
  if (!userId) return errorBadAuth(response)

  if (!(await getUserAddress(userId))) await generateUserAddress(userId) // onchain addr needed further
  try {
    let transactions = await getTransactions(userId)
    let lockedPayments = await getLockedPayments(userId)
    for (let locked of lockedPayments) {
      transactions.push({
        type: 'paid_invoice',
        fee: Math.floor(locked.amount * forwardReserveFee) /* feelimit */,
        value: locked.amount + Math.floor(locked.amount * forwardReserveFee) /* feelimit */,
        timestamp: locked.timestamp,
        memo: 'Payment in transition',
      })
    }
    return response.send(transactions)
  } catch (err) {
    console.error('', [request.uuid, 'error gettxs:', err.message, 'userid:', userId])
    return response.send([])
  }
}

export default route
