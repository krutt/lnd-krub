// ~~/src/server/routes/balance.route.ts

// imports
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
import type { LightningService } from '@/server/services/lightning'
import type { Redis } from 'ioredis'
import type { Response } from 'express'
import { User } from '@/server/models'
import { errorBadAuth, errorGeneralServerError } from '@/server/exceptions'

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
    let user = new User(bitcoin, lightning, redis)
    try {
      console.log('/balance', [request.uuid])
      if (!(await user.loadByAuthorization(request.headers.authorization))) {
        return errorBadAuth(response)
      }
      console.log('/balance', [request.uuid, 'userid: ' + user.getUserId()])
      if (!(await user.getAddress())) await user.generateAddress() // onchain address needed further
      await user.accountForPosibleTxids()
      let balance = await user.getBalance()
      if (balance < 0) balance = 0
      return response.send({ BTC: { AvailableBalance: balance } })
    } catch (err) {
      console.error('', [request.uuid, 'error getting balance:', err, 'userid:', user.getUserId()])
      return errorGeneralServerError(response)
    }
  }
