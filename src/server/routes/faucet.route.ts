// ~~/src/server/routes/faucet.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { CacheService } from '@/server/services/cache'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'
import { Invo } from '@/server/models/Invo'
import { User } from '@/server/models/User'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'
import { promisify } from 'node:util'
import { randomBytes } from 'crypto'

export default (
    bitcoin: BitcoinService,
    cache: CacheService,
    lightning: LightningService
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/faucet', [request.uuid])
    let user = new User(bitcoin, cache, lightning)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    let amt = parseInt(request.body.amt || 0)
    if (!amt) return response.send({ balance: 0 })
    let r_preimage = randomBytes(32).toString('base64')
    let faucet: User = new User(bitcoin, cache, lightning)
    let invoice = await promisify(lightning.addInvoice)
      .bind(lightning)({
        memo: 'faucet',
        value: amt,
        expiry: 3600 * 24,
        r_preimage,
      })
      .catch(() => {})
    if (!invoice) return errorGeneralServerError(response)
    await user.saveUserInvoice(invoice)
    let invoiceModel = new Invo(cache, lightning)
    await invoiceModel.savePreimage(r_preimage)
    await user.clearBalanceCache()
    faucet.userid = 'faucet'
    await faucet.savePaidLndInvoice({
      timestamp: Math.floor(+new Date() / 1000),
      type: 'faucet',
      value: amt,
      fee: 0,
      memo: 'faucet',
      pay_req: invoice.payment_request,
    })
    invoiceModel.setPaymentRequest(invoice.payment_request)
    await invoiceModel.markAsPaidInDatabase()

    let balance = await user.getCalculatedBalance()
    return response.send({ balance })
  }
