// ~~/tests/lndkrub/transactions.spec.ts

// imports
import { Transaction, UserAuth } from '@/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

let authHeaders: { Authorization: string }

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
  let testLogin: string = ''
  let testPassword: string = ''
  await supertest(lndkrub)
    .post('/create')
    .set('Accept', 'application/json')
    .then((response: { body: { login: string; password: string } }) => {
      let { login, password } = response.body
      testLogin = login
      testPassword = password
    })
  await supertest(lndkrub)
    .post('/auth')
    .send({ login: testLogin, password: testPassword })
    .set('Accept', 'application/json')
    .then((response: { body: UserAuth }) => {
      let { accessToken } = response.body
      authHeaders = { Authorization: `Bearer ${accessToken}` }
    })
})

describe('GET /gettxs', () => {
  it('responds with empty list of transactions', async () => {
    await supertest(lndkrub)
      .get('/gettxs')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: Transaction[] }) => {
        let transactions = response.body
        expect(transactions).toBeTruthy()
        expect(transactions.length).toBe(0)
      })
  })
})

describe('POST /faucet then GET /gettxs', () => {
  let amt: number = 1_000
  beforeAll(async () => {
    await supertest(lndkrub)
      .post('/faucet')
      .send({ amt })
      .set(authHeaders)
  })
  it('responds with empty list of transactions', async () => {
    await supertest(lndkrub)
      .get('/balance')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { BTC: { AvailableBalance: number } } }) => {
        let { BTC } = response.body
        expect(BTC).toBeTruthy()
        expect(BTC.AvailableBalance).toBeTypeOf('number')
        expect(BTC.AvailableBalance).toBe(amt)
      })
    await supertest(lndkrub)
      .get('/gettxs')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: Transaction[] }) => {
        let transactions = response.body
        expect(transactions).toBeTruthy()
        expect(transactions.length).toBe(1) // Must recognize faucet transaction
      })
  })
})