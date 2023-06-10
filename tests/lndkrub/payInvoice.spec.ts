// ~~/tests/lndkrub/payInvoice.spec.ts

// imports
import { Invoice } from 'τ/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

let authHeaders: { Authorization: string }
let testPaymentRequest: string

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
    .then((response: { body: { login: string; password: string; userId: string } }) => {
      let { login, password } = response.body
      // persistence
      testLogin = login
      testPassword = password
    })
  await supertest(lndkrub)
    .post('/auth')
    .send({ login: testLogin, password: testPassword })
    .set('Accept', 'application/json')
    .then((response: { body: { access_token: string; refresh_token: string } }) => {
      let { access_token } = response.body
      // persistence
      authHeaders = { Authorization: `Bearer ${access_token}` }
    })
  let recipient: { access_token?: string; login: string; password: string }
  await supertest(lndkrub)
    .post('/create')
    .set('Accept', 'application/json')
    .then((response: { body: { login: string; password: string } }) => {
      recipient = response.body
    })
  await supertest(lndkrub)
    .post('/auth')
    .send({ ...recipient })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .then((response: { body: { access_token: string } }) => {
      recipient.access_token = response.body.access_token
    })
  await supertest(lndkrub)
    .post('/addinvoice')
    .set({ Authorization: `Bearer ${recipient.access_token}` })
    .send({ amt: 100, memo: 'test recipient' })
    .expect(200)
    .expect('Content-Type', /json/)
    .then((response: { body: Invoice }) => {
      testPaymentRequest = response.body.payment_request
    })
})

describe('POST /payinvoice with no body', () => {
  it('responds with bad arguments error`', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { code: number; error: boolean; message: string } }) =>
        expect(response.body).toStrictEqual({
          code: 8,
          error: true,
          message: 'Bad arguments',
        })
      )
  })
})

describe('POST /payinvoice with test payment request but insufficient balance', () => {
  it('responds with `not enough balance.` error', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice: testPaymentRequest })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { code: number; error: boolean; message: string } }) => {
        expect(response.body).toStrictEqual({
          code: 2,
          error: true,
          message: 'not enough balance. Make sure you have at least 1% reserved for potential fees',
        })
      })
  })
})

describe('POST /payinvoice with test payment request after receiving sats from faucet', () => {
  let amount = 200
  it('responds with new balance equal to requested amount', async () => {
    await supertest(lndkrub)
      .post('/faucet')
      .send({ amt: amount })
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { balance: number } }) => {
        let { balance } = response.body
        expect(balance).toBeTypeOf('number')
        expect(balance).toBe(amount)
      })
  })
  it('responds with new balance equal to fauceted amount', async () => {
    await supertest(lndkrub)
      .get('/balance')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { BTC: { AvailableBalance: number } } }) => {
        let { BTC } = response.body
        expect(BTC).toBeTruthy()
        expect(BTC.AvailableBalance).toBeTypeOf('number')
        expect(BTC.AvailableBalance).toBe(amount)
      })
  })
  it('responds with successful payment', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice: testPaymentRequest })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { description: string; num_satoshis: string } }) => {
        let { description, num_satoshis } = response.body
        expect(description).toBeTypeOf('string')
        expect(description).toStrictEqual('test recipient')
        expect(num_satoshis).toBeTypeOf('string')
        expect(+num_satoshis).toBe(100)
      })
  })
})
