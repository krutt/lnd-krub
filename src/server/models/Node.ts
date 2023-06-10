// ~~/src/server/models/Nodekey.ts

// imports
import type { LightningService } from '@/server/services/lightning'
import type { Redis as RedisService } from 'ioredis'
import { promisify } from 'node:util'

export class Node {
  _lightning: LightningService
  _redis: RedisService

  /**
   *
   * @param {LightningService} lightning
   * @param {RedisService} redis
   */
  constructor(lightning: LightningService, redis: RedisService) {
    this._lightning = lightning
    this._redis = redis
  }

  async identityPubkey(): Promise<string> {
    let pubkey = await this._redis.get('lightning_identity_pubkey')
    if (!pubkey) {
      let info: { identity_pubkey: string } = await promisify(this._lightning.getInfo)
        .bind(this._lightning)({})
        .catch(console.error)
      if (info) {
        pubkey = info.identity_pubkey
        await this._redis.setex('lightning_identity_pubkey', 120000, pubkey)
      }
    }
    return pubkey
  }

  async release(): Promise<void> {
    await this._redis.del('lightning_identity_pubkey')
  }
}

export default Node
