// ~~/tests/lndkrub/addInvoice.spec.ts

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
})

describe('POST /addinvoice', () => {
  it('responds with an invoice instance', async () => {
    await supertest(lndkrub)
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
