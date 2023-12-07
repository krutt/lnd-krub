/* ~~/src/server/services/nostr.ts */

import { Event, Kind } from '@/types/nostr'
import { base64 } from '@scure/base'
import { secp256k1 } from '@noble/curves/secp256k1'
import { randomBytes } from '@noble/hashes/utils'

export const utf8Encoder = new TextEncoder()

export async function encryptNIP04(privkey: string, pubkey: string, text: string): Promise<string> {
  const key = secp256k1.getSharedSecret(privkey, '02' + pubkey)
  const normalizedKey = getNormalizedX(key)

  let iv = Uint8Array.from(randomBytes(16))
  let plaintext = utf8Encoder.encode(text)
  let cryptoKey = await crypto.subtle.importKey('raw', normalizedKey, { name: 'AES-CBC' }, false, [
    'encrypt',
  ])
  let ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, plaintext)
  let ctb64 = base64.encode(new Uint8Array(ciphertext))
  let ivb64 = base64.encode(new Uint8Array(iv.buffer))

  return `${ctb64}?iv=${ivb64}`
}

function getNormalizedX(key: Uint8Array): Uint8Array {
  return key.slice(1, 33)
}

export const makeNwcRequestEvent = async (
  pubkey: string,
  secret: string,
  invoice: string
): Promise<Event> => {
  const content = {
    method: 'pay_invoice',
    params: {
      invoice,
    },
  }
  const encryptedContent = await encryptNIP04(secret, pubkey, JSON.stringify(content))
  let event: Event = {
    kind: Kind.NwcRequest,
    created_at: Math.round(Date.now() / 1000),
    content: encryptedContent,
    tags: [['p', pubkey]],
  }

  // event.pubkey = getPublicKey(privateKey)
  // event.id = getEventHash(event)
  // event.sig = getSignature(event, privateKey)

  return event
}

export const parseConnectionString = (connectionString: string) => {
  const { pathname, searchParams } = new URL(connectionString)
  const pubkey = pathname
  const relay = searchParams.get('relay')
  const secret = searchParams.get('secret')

  if (!pubkey || !relay || !secret) {
    throw new Error('invalid connection string')
  }

  return { pubkey, relay, secret }
}

export default { encryptNIP04, getNormalizedX, makeNwcRequestEvent, parseConnectionString }
