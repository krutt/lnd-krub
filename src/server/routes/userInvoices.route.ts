// ~~/src/server/routes/getUserInvoices.ts

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
    console.log('/getuserinvoices', [request.id])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    console.log('/getuserinvoices', [request.id, 'userid: ' + user.getUserId()])

    try {
      // @ts-ignore
      let invoices = await user.getUserInvoices(request.query.limit)
      return response.send(invoices)
    } catch (err) {
      console.log('', [
        request.id,
        'error getting user invoices:',
        err.message,
        'userid:',
        user.getUserId(),
      ])
      return response.send([])
    }
  }
