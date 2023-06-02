// ~~/tests/lndkrub/public.spec.ts

// imports
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(() => {
  lndkrub.emit('event:startup')
})

// public routes
describe('GET /getinfo', () => {
  it('responds with lightning node daemon information', async () => {
    await supertest(lndkrub)
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
