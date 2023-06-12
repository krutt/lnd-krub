// ~~/src/server/routes/checkPayment.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis as RedisService } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth } from '@/server/exceptions'

export default (
    bitcoin: BitcoinService,
    lightning: LightningService,
    redis: RedisService
  ): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/checkpayment', [request.uuid])
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
