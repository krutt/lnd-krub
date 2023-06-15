// ~~/src/server/models/Nodekey.ts

// imports
import type { CacheService } from '@/server/services/cache'
import type { LightningService } from '@/server/services/lightning'
import { promisify } from 'node:util'

export class Node {
  _cache: CacheService
  _lightning: LightningService

  /**
   *
   * @param {CacheService} cache
   * @param {LightningService} lightning
   */
  constructor(cache: CacheService, lightning: LightningService) {
    this._cache = cache
    this._lightning = lightning
  }

  async identityPubkey(): Promise<string> {
    let pubkey = await this._cache.get('lightning_identity_pubkey')
    if (!pubkey) {
      let info: { identity_pubkey: string } = await promisify(this._lightning.getInfo)
        .bind(this._lightning)({})
        .catch(console.error)
      if (info) {
        pubkey = info.identity_pubkey
        await this._cache.setex('lightning_identity_pubkey', 120000, pubkey)
      }
    }
    return pubkey
  }

  async release(): Promise<void> {
    await this._cache.del('lightning_identity_pubkey')
  }
}

export default Node
