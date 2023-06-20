// ~~/tests/lndkrub/payInvoice.spec.ts

// imports
import { Invoice, Payment, UserAuth } from '@/types'
import { LightningService } from '@/server/services/lightning'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { externalLND } from 'τ/configs'
import lndkrub from '@/index'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import supertest from 'supertest'

let lnext: LightningService

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
  lnext = new LightningService(
    externalLND.host,
    externalLND.macaroonPath,
    externalLND.port,
    externalLND.tlsCertPath
  )
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
      .then((response: { body: UserAuth }) => {
        let { accessToken } = response.body
        authHeaders = { Authorization: `Bearer ${accessToken}` }
      })
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
  let recipient: { accessToken?: string; login: string; password: string }
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
      .then((response: { body: UserAuth }) => {
        let { accessToken } = response.body
        authHeaders = { Authorization: `Bearer ${accessToken}` }
      })
    await supertest(lndkrub)
      .post('/create')
      .then(
        (response: { body: { login: string; password: string } }) => (recipient = response.body)
      )
    await supertest(lndkrub)
      .post('/auth')
      .send({ ...recipient })
      .then((response: { body: UserAuth }) => {
        recipient.accessToken = response.body.accessToken
      })
    await supertest(lndkrub)
      .post('/addinvoice')
      .set({ Authorization: `Bearer ${recipient.accessToken}` })
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
  let recipient: { accessToken?: string; login: string; password: string }
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
      .then((response: { body: UserAuth }) => {
        let { accessToken } = response.body
        authHeaders = { Authorization: `Bearer ${accessToken}` }
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
      .then((response: { body: UserAuth }) => {
        recipient.accessToken = response.body.accessToken
      })
    await supertest(lndkrub)
      .post('/addinvoice')
      .set({ Authorization: `Bearer ${recipient.accessToken}` })
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
      .then((response: { body: UserAuth }) => {
        let { accessToken } = response.body
        authHeaders = { Authorization: `Bearer ${accessToken}` }
      })
    await supertest(lndkrub).post('/faucet').set(authHeaders).send({ amt: faucetAmount })
    // external invoice
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
      .then((response: { body: Payment }) => {
        let description = response.body.decoded?.description
        let num_satoshis = response.body.decoded?.num_satoshis
        expect(description).toBeTypeOf('string')
        expect(description).toStrictEqual(memo)
        expect(num_satoshis).toBeTypeOf('string')
        expect(+num_satoshis).toBe(amt)
      })
  })
})
