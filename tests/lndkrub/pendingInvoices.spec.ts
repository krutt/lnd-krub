// ~~/tests/lndkrub/channels.spec.ts

// imports
import lndkrub from '@/index'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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
})

describe('GET /getpending', () => {
  it('responds with a list of pending invoices', async () => {
    await supertest(lndkrub)
      .get('/getpending')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      // TODO: Improve typing
      .then((response: { body: string[] }) => {
        let invoices = response.body
        expect(invoices).toBeTruthy()
        expect(invoices.length).toBeFalsy()
        // TODO: More tests and more validations
      })
  })
})
