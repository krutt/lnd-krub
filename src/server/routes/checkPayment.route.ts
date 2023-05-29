// ~~/src/server/routes/checkPayment.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth } from '@/server/exceptions'

export default (
    bitcoin: BitcoinService,
    lightning: LightningService,
    redis: Redis
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param request
   * @param response
   * @returns
   */
  async (request: LNDKrubRequest, response: Response) => {
    console.log('/checkpayment', [request.id])
    let user = new User(bitcoin, lightning, redis)
    await user.loadByAuthorization(request.headers.authorization)

    if (!user.getUserId()) {
      return errorBadAuth(response)
    }

    let paid = true
    if (!(await user.getPaymentHashPaid(request.params.payment_hash))) {
      // Not found on cache
      paid = await user.syncInvoicePaid(request.params.payment_hash)
    }
    return response.send({ paid: paid })
  }
