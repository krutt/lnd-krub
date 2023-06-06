// ~~/tests/lndkrub/createAccount.spec.ts

// imports
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(() => {
  lndkrub.emit('event:startup')
})

describe('POST /create', () => {
  it('responds with newly generated user account', async () => {
    await supertest(lndkrub)
      .post('/create')
      .send({})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then((response: { body: { login: string; password: string } }) => {
        let { login, password } = response.body
        expect(login).toBeTruthy()
        expect(login.length).toBe(20)
        expect(password).toBeTruthy()
        expect(password.length).toBe(20)
      })
  })
})
