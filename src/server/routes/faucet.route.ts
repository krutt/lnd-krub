// ~~/src/server/routes/faucet.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { calculateBalance, clearBalanceCache } from '@/server/models/_user'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import { loadUserByAuthorization, savePaidLndInvoice, saveUserInvoice } from '@/server/models/_user'
import { markAsPaidInDatabase, savePreimage } from '@/server/models/_invoice'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'

export default (lightning: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/faucet', [request.uuid])
    let userId = await loadUserByAuthorization(request.headers.authorization)
    if (!userId) return errorBadAuth(response)

    let amount = parseInt(request.body.amt || request.body.amount || 0)
    if (amount) {
      let r_preimage = randomBytes(32).toString('base64')
      let invoice = await promisify(lightning.addInvoice)
        .bind(lightning)({
          memo: 'faucet',
          value: amount,
          expiry: 3600 * 24,
          r_preimage,
        })
        .catch(err => {
          console.log('*-*-*-*-*')
          console.error(err)
          console.log('*-*-*-*-*')
        })
      if (!invoice) return errorGeneralServerError(response)
      await saveUserInvoice(invoice, userId)
      await savePreimage(r_preimage)
      await clearBalanceCache(userId)
      await savePaidLndInvoice({
        timestamp: Math.floor(+new Date() / 1000),
        type: 'faucet',
        value: amount,
        fee: 0,
        memo: 'faucet',
        pay_req: invoice.payment_request,
      }, 'faucet')
      await markAsPaidInDatabase(invoice.payment_request)
    }
    let balance = await calculateBalance(userId)
    return response.send({ balance })
  }
