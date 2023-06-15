// ~~/src/server/models/Nodekey.ts

// imports
import type { CacheService } from '@/server/services/cache'
import type { LightningService } from '@/server/services/lightning'
import { promisify } from 'node:util'

export class Node {
  cache: CacheService
  lightning: LightningService

  /**
   *
   * @param {CacheService} cache
   * @param {LightningService} lightning
   */
  constructor(cache: CacheService, lightning: LightningService) {
    this.cache = cache
    this.lightning = lightning
  }

  async identityPubkey(): Promise<string> {
    let pubkey = await this.cache.get('lightning_identity_pubkey')
    if (!pubkey) {
      let info: { identity_pubkey: string } = await promisify(this.lightning.getInfo)
        .bind(this.lightning)({})
        .catch(console.error)
      if (info) {
        pubkey = info.identity_pubkey
        await this.cache.setex('lightning_identity_pubkey', 120000, pubkey)
      }
    }
    return pubkey
  }

  async release(): Promise<void> {
    await this.cache.del('lightning_identity_pubkey')
  }
}

export default Node
