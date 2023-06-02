// ~~/tests/lndhub/private.spec.ts

// imports
import { Express } from 'express'
import { Invoice, Transaction, createLNDHub } from 'τ/mocks/lndhub'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'

let authHeaders: { Authorization: string }
let lndhub: Express

afterAll(() => {
  lndhub.emit('event:shutdown')
})

beforeAll(async () => {
  lndhub = createLNDHub()
  lndhub.emit('event:startup')
  let testLogin: string = ''
  let testPassword: string = ''
  await supertest(lndhub)
    .post('/create')
    .set('Accept', 'application/json')
    .then((response: { body: { login: string; password: string; userId: string } }) => {
      let { login, password } = response.body
      // persistence
      testLogin = login
      testPassword = password
    })
  await supertest(lndhub)
    .post('/auth')
    .send({ login: testLogin, password: testPassword })
    .set('Accept', 'application/json')
    .then((response: { body: { access_token: string; refresh_token: string } }) => {
      let { access_token } = response.body
      // persistence
      authHeaders = { Authorization: `Bearer ${access_token}` }
    })
})

describe('POST /addinvoice', () => {
  it('responds with an invoice instance', async () => {
    await supertest(lndhub)
      .post('/addinvoice')
      .set(authHeaders)
      .send({ memo: 'test', amt: 10 })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then((response: { body: Invoice }) => {
        let { add_index, payment_request, r_hash } = response.body
        expect(add_index).toBeTypeOf('string')
        expect(payment_request).toBeTypeOf('string')
        expect(r_hash.type).toBe('Buffer')
        expect(r_hash.data).toBeInstanceOf(Array<Number>)
      })
  })
})

describe('GET /balance', () => {
  it('responds with available balance for bitcoin wallet', async () => {
    await supertest(lndhub)
      .get('/balance')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { BTC: { AvailableBalance: number } } }) => {
        let { BTC } = response.body
        expect(BTC).toBeTruthy()
        expect(BTC.AvailableBalance).toBeTypeOf('number')
        expect(BTC.AvailableBalance).toBe(0)
      })
  })
})

describe('GET /getbtc x 2', () => {
  let testBtcAddress: string = ''
  it('responds with a new bitcoin address', async () => {
    await supertest(lndhub)
      .get('/getbtc')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { address: string } }) => {
        let { address } = response.body
        expect(address).toBeTruthy()
        expect(address.length).toBe(44)
        expect(address.slice(0, 6)).toStrictEqual('bcrt1q')
        // persistence
        testBtcAddress = address
      })
  })

  it('responds with the same bitcoin address as previously', async () => {
    await supertest(lndhub)
      .get('/getbtc')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { address: string } }) => {
        let { address } = response.body
        expect(address).toBeTruthy()
        expect(address.length).toBe(44)
        expect(address.slice(0, 5)).toStrictEqual('bcrt1')
        expect(address).toStrictEqual(testBtcAddress)
      })
  })
})

describe('GET /gettxs', () => {
  it('responds with transactions made by lightning node daemon', async () => {
    await supertest(lndhub)
      .get('/gettxs')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { transactions: Transaction[] } }) => {
        let { transactions } = response.body
        expect(transactions).toBeTruthy() // not empty
        expect(transactions[0].amount).toBeTypeOf('string')
        expect(transactions[0].block_height).toBeTypeOf('number')
      })
  })
})

describe('GET /getuserinvoices', () => {
  it('responds with a list of user invoices belonging to user', async () => {
    await supertest(lndhub)
      .get('/getuserinvoices')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: Invoice[] }) => {
        let invoices: Invoice[] = response.body
        expect(invoices).toBeTruthy()
        expect(invoices.length).toBeGreaterThan(0)
        for (let invoice of invoices) {
          expect(invoice.add_index).toBeTypeOf('string')
          expect(invoice.payment_request).toBeTypeOf('string')
          expect(invoice.payment_request.length).toBe(267)
          // https://github.com/lightning/bolts/blob/master/11-payment-encoding.md
          expect(invoice.payment_request.slice(0, 6)).toStrictEqual('lnbcrt') // regtest
          expect(invoice.r_hash.type).toStrictEqual('Buffer')
          expect(invoice.r_hash.data).toBeInstanceOf(Array<number>)

          // optional Invoice attributes
          expect(invoice.amt).toBeTruthy()
          expect(invoice.amt).toBeGreaterThan(0)
          expect(invoice.description).toBeTruthy()
          expect(invoice.description).toStrictEqual('test')
          expect(invoice.expire_time).toBeTruthy()
          expect(invoice.expire_time).toBe(86400)
          expect(invoice.ispaid).toBe(false)
          expect(invoice.timestamp).toBeTruthy()
          expect(invoice.timestamp).toBeTypeOf('number')
          expect(invoice.timestamp).toBeLessThan(Math.floor(new Date().getTime() / 1000))
          expect(invoice.type).toStrictEqual('user_invoice')
          expect(invoice.userid).toBeTruthy()
          // @ts-ignore
          expect(invoice.userid.length).toBe(64)
        }
      })
  })
})

describe('GET /payinvoice', () => {
  it('responds with `{ "msg": "TODO" }`', async () => {
    await supertest(lndhub)
      .post('/payinvoice')
      .set(authHeaders)
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { msg: string } }) =>
        expect(response.body).toStrictEqual({ msg: 'TODO' })
      )
  })
})
