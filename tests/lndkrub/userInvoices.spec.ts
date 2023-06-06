// ~~/tests/lndkrub/userInvoices.spec.ts

// imports
import { Invoice } from 'τ/types'
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
  await supertest(lndkrub)
    .post('/addinvoice')
    .send({ amt: 100, memo: 'test' })
    .set(authHeaders)
    .expect(200)
    .expect('Content-Type', /json/)
    .then(
      (response: {
        body: {
          r_hash: { type: 'Buffer'; data: number[] }
          payment_request: string
          add_index: string
        }
      }) => {
        let { r_hash, payment_request, add_index } = response.body
        expect(r_hash).toBeTruthy()
        expect(payment_request).toBeTruthy()
        expect(add_index).toBeTruthy()
      }
    )
})

describe('GET /getuserinvoices', () => {
  it('responds with a list of user invoices belonging to user', async () => {
    await supertest(lndkrub)
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
          expect(invoice.payment_request.length).toBe(265)
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
          expect(invoice.timestamp).toBeLessThanOrEqual(Math.floor(new Date().getTime() / 1000))
          expect(invoice.type).toStrictEqual('user_invoice')
          // expect(invoice.userid).toBeTruthy()
          // expect(invoice.userid.length).toBe(64)
        }
      })
  })
})
