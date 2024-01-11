/* ~~/tests/lndkrub/info.spec.ts */

// imports
// import 'websocket-polyfill'
import { SimplePool } from 'nostr-tools'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bytesToHex } from '@noble/hashes/utils'
import lndkrub from '@/index'
import { schnorr } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import supertest from 'supertest'

let privkey: string
let pubkey: string

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
  privkey = bytesToHex(schnorr.utils.randomPrivateKey())
  pubkey = bytesToHex(schnorr.getPublicKey(privkey))
})

describe.skip('POST /nwc', () => {
  it('responds with newly generated user account', async () => {
    await supertest(lndkrub)
      .post('/nwc') // nip47
      .send({ pubkey })
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .then(async (response: { body: { connection: string } }) => {
        let { connection } = response.body
        let url: URL = new URL(decodeURIComponent(connection))
        expect(url).toBeTruthy()
        expect(url.protocol).toBe('nostr+walletconnect:')
        expect(url.pathname).toBe(pubkey)
        let relay = url.searchParams.get('relay')
        expect(relay).toBeTruthy()
        expect(relay).toBe('wss://localhost:7000') // TODO: tentative
        let secret = url.searchParams.get('secret')
        expect(secret).toBeTruthy()
        expect(secret.length).toBe(44)

        let event = {
          id: null,
          sig: null,
          pubkey,
          created_at: Math.round(Date.now() / 1000),
          content: 'test',
          kind: 22345,
          tags: [],
        }
        event.pubkey = pubkey
        let utf8Encoder = new TextEncoder()
        event.id = bytesToHex(
          sha256(
            utf8Encoder.encode(
              JSON.stringify([
                0,
                event.pubkey,
                event.created_at,
                event.kind,
                event.tags,
                event.content,
              ])
            )
          )
        )
        event.sig = bytesToHex(schnorr.sign(event.id, privkey))
        let pool: SimplePool = new SimplePool()
        await pool.publish([relay], event)
        pool.close([relay])
      })
  })
})
