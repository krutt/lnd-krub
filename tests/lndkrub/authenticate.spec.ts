// ~~/tests/lndkrub/authenticate.spec.ts

// imports
import type { UserAuth } from '@/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import lndkrub from '@/index'
import supertest from 'supertest'

let testLogin: null | string = null
let testPassword: null | string = null

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
      testLogin = login
      testPassword = password
    })
})

describe('POST /auth x 2', () => {
  it('responds with accessToken and refreshToken key-values', async () => {
    let testAccessToken: null | string = null
    let testRefreshToken: null | string = null
    await supertest(lndkrub)
      .post('/auth')
      .query({ type: 'auth' })
      .send({ login: testLogin, password: testPassword })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: UserAuth }) => {
        let { accessToken, refreshToken } = response.body
        expect(accessToken).toBeTruthy()
        expect(accessToken.length).toBe(40)
        expect(refreshToken).toBeTruthy()
        expect(refreshToken.length).toBe(40)
        testAccessToken = accessToken
        testRefreshToken = refreshToken
      })
    await supertest(lndkrub)
      .post('/auth')
      .query({ type: 'auth' })
      .send({ refreshToken: testRefreshToken })
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: UserAuth }) => {
        let { accessToken, refreshToken } = response.body
        expect(accessToken).toBeTruthy()
        expect(accessToken.length).toBe(40)
        expect(refreshToken).toBeTruthy()
        expect(refreshToken.length).toBe(40)
        expect(accessToken.length).not.toStrictEqual(testAccessToken)
        testAccessToken = testAccessToken || ''
        expect(accessToken.length).toBe(testAccessToken.length)
        expect(refreshToken).not.toStrictEqual(testRefreshToken)
        testRefreshToken = testRefreshToken || ''
        expect(refreshToken.length).toBe(testRefreshToken.length)
      })
  })
})
