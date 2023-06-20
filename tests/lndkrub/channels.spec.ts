// ~~/tests/lndkrub/channels.spec.ts

// imports
import type { Channel, UserAuth } from '@/types'
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
    .then((response: { body: { login: string; password: string } }) => {
      let { login, password } = response.body
      testLogin = login
      testPassword = password
    })
  await supertest(lndkrub)
    .post('/auth')
    .send({ login: testLogin, password: testPassword })
    .set('Accept', 'application/json')
    .then((response: { body: UserAuth }) => {
      let { accessToken } = response.body
      authHeaders = { Authorization: `Bearer ${accessToken}` }
    })
})

describe('GET /channels', () => {
  it('responds with a list of channels connected to lightning node', async () => {
    await supertest(lndkrub)
      .get('/channels')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { channels: Channel[] } }) => {
        let { channels } = response.body
        expect(channels).toBeTruthy()
        expect(channels).toBeTypeOf('object') // array
        expect(channels.length).toBeGreaterThan(0)
        // TODO: Other validations
      })
  })
})
