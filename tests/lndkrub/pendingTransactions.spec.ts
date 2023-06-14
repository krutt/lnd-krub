// ~~/tests/lndkrub/pendingTransactions.spec.ts

// imports
import { Transaction } from '@/types'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import bitcoin from 'τ/services/bitcoin'
import lndkrub from '@/index'
import supertest from 'supertest'

afterAll(() => {
  lndkrub.emit('event:shutdown')
})

beforeAll(async () => {
  lndkrub.emit('event:startup')
})

describe('GET /getpending when creating a fresh account', () => {
  let authHeaders: { Authorization: string }
  beforeAll(async () => {
    let login: string | null = null
    let password: string | null = null
    await supertest(lndkrub)
      .post('/create')
      .then((response: { body: { login: string; password: string } }) => {
        login = response.body.login
        password = response.body.password
      })
    await supertest(lndkrub)
      .post('/auth')
      .send({ login, password })
      .then((response: { body: { access_token: string } }) => {
        authHeaders = { Authorization: `Bearer ${response.body.access_token}` }
      })
  })
  it('responds with a list of empty pending transactions', async () => {
    await supertest(lndkrub)
      .get('/getpending')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: Transaction[] }) => {
        let transactions = response.body
        expect(transactions).toBeTruthy()
        expect(transactions).toBeTypeOf('object') // array
        expect(transactions.length).toBe(0)
      })
  })
})

describe('GET /getpending after sending new transaction to address', () => {
  let address: string | null = null
  let authHeaders: { Authorization: string }
  beforeAll(async () => {
    let login: string | null = null
    let password: string | null = null
    await supertest(lndkrub)
      .post('/create')
      .then((response: { body: { login: string; password: string } }) => {
        login = response.body.login
        password = response.body.password
      })
    await supertest(lndkrub)
      .post('/auth')
      .send({ login, password })
      .then((response: { body: { access_token: string } }) => {
        authHeaders = { Authorization: `Bearer ${response.body.access_token}` }
      })
    await supertest(lndkrub)
      .get('/getbtc')
      .set(authHeaders)
      .then((response: { body: [{ address: string }] }) => {
        address = response.body[0].address
      })
    await bitcoin.request('sendtoaddress', [address, 10])
    await bitcoin.request('getrawmempool', [])
    await bitcoin.request('generateblock', [address, []])
  })
  it('responds with a list of one pending transaction', async () => {
    await supertest(lndkrub)
      .get('/getpending')
      .set(authHeaders)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response: { body: Transaction[] }) => {
        let transactions = response.body
        expect(transactions).toBeTruthy()
        expect(transactions).toBeTypeOf('object') // array
        expect(transactions.length).toBe(1)
      })
  })
})
