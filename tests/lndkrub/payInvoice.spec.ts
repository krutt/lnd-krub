// ~~/tests/lndkrub/payInvoice.spec.ts

// imports
import { Invoice } from '@/types'
import { LightningService, LnRpc, createLNDCreds } from 'τ/services/lnrpc'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lndTarget } from 'τ/configs'
import lndkrub from '@/index'
import { promisify } from 'node:util'
import { randomBytes } from 'crypto'
import supertest from 'supertest'

let authHeaders: { Authorization: string }
let testInternalPaymentRequest: string
let external: LightningService
let testExternalPaymentRequest: string

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
      testInternalPaymentRequest = response.body.payment_request
    })

  // external invoice
  external = new LnRpc.Lightning(
    `${lndTarget.host}:${lndTarget.port}`,
    createLNDCreds(lndTarget.macaroonPath, lndTarget.tlsCertPath)
  )
  let testInvoice = await promisify(external.addInvoice).bind(external)({
    amt: 100,
    expiry: 20,
    memo: 'external',
    r_preimage: randomBytes(32).toString('base64'),
  })
  testExternalPaymentRequest = testInvoice.payment_request
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
      .send({ invoice: testInternalPaymentRequest })
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
  let amount = 500
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
      .send({ invoice: testInternalPaymentRequest })
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

describe('POST /payinvoice with test external payment request', () => {
  it('responds with successful payment', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice: testExternalPaymentRequest })
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
