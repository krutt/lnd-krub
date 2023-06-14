// ~~/src/server/routes/transactions.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { LightningService } from '@/server/services/lightning'
import type { Redis as RedisService } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth } from '@/server/exceptions'
import { forwardReserveFee } from '@/configs'

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
    console.log('/gettxs', [request.uuid])
    let user = new User(bitcoin, lightning, redis)
    if (!(await user.loadByAuthorization(request.headers.authorization))) {
      return errorBadAuth(response)
    }
    console.log('/gettxs', [request.uuid, 'userid: ' + user.getUserId()])

    if (!(await user.getAddress())) await user.generateAddress() // onchain addr needed further
    try {
      let txs = await user.getTxs()
      let lockedPayments = await user.getLockedPayments()
      for (let locked of lockedPayments) {
        txs.push({
          type: 'paid_invoice',
          fee: Math.floor(locked.amount * forwardReserveFee) /* feelimit */,
          value: locked.amount + Math.floor(locked.amount * forwardReserveFee) /* feelimit */,
          timestamp: locked.timestamp,
          memo: 'Payment in transition',
        })
      }
      return response.send(txs)
    } catch (err) {
      console.log('', [request.uuid, 'error gettxs:', err.message, 'userid:', user.getUserId()])
      return response.send([])
    }
  }
