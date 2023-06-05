// ~~/tests/lndkrub/bitcoinAddress.spec.ts

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

describe('GET /getbtc x 2', () => {
  let testBtcAddress: string = ''
  it('responds with a new bitcoin address', async () => {
    await supertest(lndkrub)
      .get('/getbtc')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { address: string } }) => {
        let { address } = response.body[0]
        expect(address).toBeTruthy()
        expect(address.length).toBe(44)
        expect(address.slice(0, 6)).toStrictEqual('bcrt1q')
        // persistence
        testBtcAddress = address
      })
  })

  it('responds with the same bitcoin address as previously', async () => {
    await supertest(lndkrub)
      .get('/getbtc')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: { address: string } }) => {
        let { address } = response.body[0]
        expect(address).toBeTruthy()
        expect(address.length).toBe(44)
        expect(address.slice(0, 5)).toStrictEqual('bcrt1')
        expect(address).toStrictEqual(testBtcAddress)
      })
  })
})
