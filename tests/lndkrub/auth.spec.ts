// ~~/tests/lndkrub/auth.spec.ts

// imports
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

let testLogin: string | null = null
let testPassword: string | null = null

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
  await supertest(lndkrub)
    .post('/create')
    .send({})
    .set('Accept', 'application/json')
    .then((response: { body: { login: string; password: string } }) => {
      let { login, password } = response.body
      // persistence
      testLogin = login
      testPassword = password
    })
})

describe('POST /auth x 2', () => {
  it('responds with accessToken and refreshToken key-values', async () => {
    let testAccessToken: string | null = null
    let testRefreshToken: string | null = null
    await supertest(lndkrub)
      .post('/auth')
      .query({ type: 'auth' })
      .send({ login: testLogin, password: testPassword })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { access_token: string; refresh_token: string } }) => {
        let { access_token, refresh_token } = response.body
        expect(access_token).toBeTruthy()
        expect(access_token.length).toBe(40)
        expect(refresh_token).toBeTruthy()
        expect(refresh_token.length).toBe(40)
        // persistence
        testAccessToken = access_token
        testRefreshToken = refresh_token
      })
    await supertest(lndkrub)
      .post('/auth')
      .query({ type: 'auth' })
      .send({ refresh_token: testRefreshToken })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { access_token: string; refresh_token: string } }) => {
        let { access_token, refresh_token } = response.body
        expect(access_token).toBeTruthy()
        expect(access_token.length).toBe(40)
        expect(refresh_token).toBeTruthy()
        expect(refresh_token.length).toBe(40)
        expect(access_token.length).not.toStrictEqual(testAccessToken)
        expect(access_token.length).toBe(testAccessToken.length)
        expect(refresh_token).not.toStrictEqual(testRefreshToken)
        expect(refresh_token.length).toBe(testRefreshToken.length)
      })
  })
})
