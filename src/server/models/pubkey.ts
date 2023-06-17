/* ~~/src/server/models/pubkey.ts */

// imports
import { cache, lightning } from '@/server/models'
import { promisify } from 'node:util'

// constants
const KEY: string = 'lightning_identity_pubkey'
const TTL: number = 120000

/**
 * Fetches the LND nodekey either from LRU cache or from the daemon connected to this application
 * @returns {String} LND nodekey
 */
export const fetchIdentityPubkey = async (): Promise<string> => {
  let pubkey = await cache.get('')
  if (!pubkey) {
    let info: { identity_pubkey: string } = await promisify(lightning.getInfo)
      .bind(lightning)({})
      .catch(console.error)
    if (info) {
      pubkey = info.identity_pubkey
      /*await */ cache.setex(KEY, TTL, pubkey)
    }
  }
  return pubkey
}

/**
 * Unsets the cached LND nodekey
 * @returns {Number}
 */
export const releaseIdentityPubkey = async (): Promise<number> => await cache.del(KEY)
