// ~~/tests/lndhub/public.spec.ts

// imports
import { Express } from 'express'
import { createLNDHub } from 'τ/services/lndhub'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'

let lndhub: Express

afterAll(() => {
  lndhub.emit('event:shutdown')
})

beforeAll(() => {
  lndhub = createLNDHub()
  lndhub.emit('event:startup')
})

// public routes
describe('GET /getinfo', () => {
  it('responds with lightning node daemon information', async () => {
    await supertest(lndhub)
      .get('/getinfo')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((resp: { body: { uris: string[]; chains: { chain: string; network: string }[] } }) => {
        let { chains, uris } = resp.body
        expect(uris).toBeTruthy() // not empty
        expect(chains).toBeTruthy() // not empty
        expect(chains[0].chain).toBe('bitcoin')
        expect(chains[0].network).toBe('regtest')
      })
  })
})
