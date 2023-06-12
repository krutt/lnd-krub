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

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
})

describe('POST /payinvoice with no body', () => {
  let authHeaders: { Authorization: string }
  let login: string | null = null
  let password: string | null = null
  beforeAll(async () => {
    await supertest(lndkrub)
      .post('/create')
      .then((response: { body: { login: string; password: string } }) => {
        login = response.body.login
        password = response.body.password
      })
    await supertest(lndkrub)
      .post('/auth')
      .send({ login, password })
      .then((response: { body: { access_token: string } }) => {
        authHeaders = { Authorization: `Bearer ${response.body.access_token}` }
      })
    await supertest(lndkrub).post('/faucet').set(authHeaders)
  })
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
  let amt: number = 200
  let authHeaders: { Authorization: string }
  let invoice: string | null = null
  let login: string | null = null
  let memo: string = 'test receipient'
  let password: string | null = null
  let recipient: { access_token?: string; login: string; password: string }
  beforeAll(async () => {
    await supertest(lndkrub)
      .post('/create')
      .then((response: { body: { login: string; password: string } }) => {
        login = response.body.login
        password = response.body.password
      })
    await supertest(lndkrub)
      .post('/auth')
      .send({ login, password })
      .then((response: { body: { access_token: string } }) => {
        authHeaders = { Authorization: `Bearer ${response.body.access_token}` }
      })
    await supertest(lndkrub)
      .post('/create')
      .then(
        (response: { body: { login: string; password: string } }) => (recipient = response.body)
      )
    await supertest(lndkrub)
      .post('/auth')
      .send({ ...recipient })
      .then((response: { body: { access_token: string } }) => {
        recipient.access_token = response.body.access_token
      })
    await supertest(lndkrub)
      .post('/addinvoice')
      .set({ Authorization: `Bearer ${recipient.access_token}` })
      .send({ amt, memo })
      .then((response: { body: Invoice }) => {
        invoice = response.body.payment_request
      })
  })
  it('responds with `not enough balance.` error', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice })
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
  let amt: number = 200
  let authHeaders: { Authorization: string }
  let faucetAmount: number = 500
  let invoice: string | null = null
  let login: string | null = null
  let memo: string = 'test recipient'
  let password: string | null = null
  let recipient: { access_token?: string; login: string; password: string }
  beforeAll(async () => {
    await supertest(lndkrub)
      .post('/create')
      .then((response: { body: { login: string; password: string } }) => {
        login = response.body.login
        password = response.body.password
      })
    await supertest(lndkrub)
      .post('/auth')
      .send({ login, password })
      .then((response: { body: { access_token: string } }) => {
        authHeaders = { Authorization: `Bearer ${response.body.access_token}` }
      })

    await supertest(lndkrub)
      .post('/create')
      .then(
        (response: { body: { login: string; password: string } }) => (recipient = response.body)
      )
    await supertest(lndkrub).post('/faucet').set(authHeaders).send({ amt: faucetAmount })
    await supertest(lndkrub)
      .post('/auth')
      .send({ ...recipient })
      .then((response: { body: { access_token: string } }) => {
        recipient.access_token = response.body.access_token
      })
    await supertest(lndkrub)
      .post('/addinvoice')
      .set({ Authorization: `Bearer ${recipient.access_token}` })
      .send({ amt, memo })
      .then((response: { body: Invoice }) => {
        invoice = response.body.payment_request
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
        expect(BTC.AvailableBalance).toBe(faucetAmount)
      })
  })
  it('responds with successful payment', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { description: string; num_satoshis: string } }) => {
        let { description, num_satoshis } = response.body
        expect(description).toBeTypeOf('string')
        expect(description).toStrictEqual('test recipient')
        expect(num_satoshis).toBeTypeOf('string')
        expect(+num_satoshis).toBe(amt)
      })
  })
})

describe('POST /payinvoice with test external payment request', () => {
  let amt: number = 200
  let authHeaders: { Authorization: string }
  let faucetAmount: number = 500
  let invoice: string | null = null
  let login: string | null = null
  let memo: string = 'external recipient'
  let password: string | null = null
  beforeAll(async () => {
    await supertest(lndkrub)
      .post('/create')
      .then((response: { body: { login: string; password: string } }) => {
        login = response.body.login
        password = response.body.password
      })
    await supertest(lndkrub)
      .post('/auth')
      .send({ login, password })
      .then((response: { body: { access_token: string } }) => {
        authHeaders = { Authorization: `Bearer ${response.body.access_token}` }
      })
    await supertest(lndkrub).post('/faucet').set(authHeaders).send({ amt: faucetAmount })
    // external invoice
    let lnext: LightningService = new LnRpc.Lightning(
      `${lndTarget.host}:${lndTarget.port}`,
      createLNDCreds(lndTarget.macaroonPath, lndTarget.tlsCertPath)
    )
    let { payment_request } = await promisify(lnext.addInvoice).bind(lnext)({
      expiry: 20,
      memo,
      r_preimage: randomBytes(32).toString('base64'),
      value: amt,
    })
    invoice = payment_request
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
        expect(BTC.AvailableBalance).toBe(faucetAmount)
      })
  })
  it('responds with successful payment', async () => {
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice })
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
