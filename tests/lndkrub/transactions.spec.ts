// ~~/tests/lndkrub/transactions.spec.ts

// imports
import { Transaction } from '@/types'
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
    .then((response: { body: { access_token: string } }) => {
      let { access_token } = response.body
      // persistence
      authHeaders = { Authorization: `Bearer ${access_token}` }
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
