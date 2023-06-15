// ~~/src/server/routes/userInvoices.route.ts

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
    console.log('/getuserinvoices', [request.uuid])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    console.log('/getuserinvoices', [request.uuid, 'userid: ' + user.getUserId()])

    try {
      // @ts-ignore
      let invoices = await user.getUserInvoices(request.query.limit)
      return response.send(invoices)
    } catch (err: any) {
      let { message }: { message?: string } = err
      console.log('', [
        request.uuid,
        'error getting user invoices:',
        message,
        'userid:',
        user.getUserId(),
      ])
      return response.send([])
    }
  }
