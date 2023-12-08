/* ~~/tests/lndkrub/info.spec.ts */

// imports
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bytesToHex } from '@noble/hashes/utils'
import lndkrub from '@/index'
import { schnorr } from '@noble/curves/secp256k1'
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

describe('POST /nwc', () => {
  it('responds with newly generated user account', async () => {
    await supertest(lndkrub)
      .post('/nwc') // nip47
      .send({ pubkey })
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .then((response: { body: { connection: string } }) => {
        let { connection } = response.body
        let url: URL = new URL(decodeURIComponent(connection))
        expect(url).toBeTruthy()
        expect(url.protocol).toBe('nostr+walletconnect:')
        expect(url.pathname).toBe(pubkey)
        let relay = url.searchParams.get('relay')
        expect(relay).toBeTruthy()
        expect(relay).toBe('wss://localhost:7000') // tentative
        let secret = url.searchParams.get('secret')
        expect(secret).toBeTruthy()
        expect(secret.length).toBe(44)
      })
  })
})
