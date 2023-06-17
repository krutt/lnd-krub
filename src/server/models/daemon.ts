// ~~/src/server/models/daemon.ts

// imports
import { cache, lightning } from '@/server/models'
import { promisify } from 'node:util'

export const getIdentityPubkey = async (): Promise<string> => {
  let pubkey = await cache.get('lightning_identity_pubkey')
  if (!pubkey) {
    let info: { identity_pubkey: string } = await promisify(lightning.getInfo)
      .bind(lightning)({})
      .catch(console.error)
    if (info) {
      pubkey = info.identity_pubkey
      await cache.setex('lightning_identity_pubkey', 120000, pubkey)
    }
  }
  return pubkey
}

export const releaseIdentityPubkey = async (): Promise<void> => {
  await cache.del('lightning_identity_pubkey')
}
