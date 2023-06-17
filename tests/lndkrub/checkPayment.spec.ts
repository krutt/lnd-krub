// ~~/tests/lndkrub/checkPayment.spec.ts

// imports
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import { randomBytes } from 'node:crypto'
import supertest from 'supertest'

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
})

describe('GET /checkpayment/ without payment hash', () => {
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
  })
  it('responds with 404 Not Found`', async () => {
    await supertest(lndkrub).get('/checkpayment/').set(authHeaders).expect(404)
  })
})

describe('GET /checkpayment/ with randomly generated payment hash', () => {
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
  })
  it('responds with empty payment status`', async () => {
    await supertest(lndkrub)
      .get(`/checkpayment/${randomBytes(32).toString('hex')}`)
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { paid?: boolean } }) => expect(response.body).toStrictEqual({}))
  })
})

describe('GET /checkpayment/ payment hash from paying invoice', () => {
  let authHeaders: { Authorization: string }
  let paymentHash: string | null = null
  beforeAll(async () => {
    let invoice: string | null = null
    let login: string | null = null
    let password: string | null = null
    let recipient: { access_token?: string; login: string; password: string }
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
      .send({ amt: 200, memo: 'test recipient' })
      .then((response: { body: { payment_request: string } }) => {
        invoice = response.body.payment_request
      })
    await supertest(lndkrub).post('/faucet').set(authHeaders).send({ amt: 500 })
    await supertest(lndkrub)
      .post('/payinvoice')
      .set(authHeaders)
      .send({ invoice })
      .then((response: { body: { payment_hash: string } }) => {
        paymentHash = response.body.payment_hash
      })
  })
  it('responds with payment status saying paid`', async () => {
    await supertest(lndkrub)
      .get(`/checkpayment/${paymentHash}`)
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { paid?: boolean } }) => {
        let { paid } = response.body
        expect(paid).toBe(true)
      })
  })
})
