// ~~/tests/lndhub/create.spec.ts

// imports
import { Express } from 'express'
import { createLNDHub } from 'τ/mocks/lndhub'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'

let lndhub: Express

afterAll(() => {
  lndhub.emit('event:shutdown')
})

beforeAll(() => {
  lndhub = createLNDHub()
  lndhub.emit('event:startup')
})

describe('POST /create', () => {
  it('responds with newly generated user account', async () => {
    await supertest(lndhub)
      .post('/create')
      .send({})
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(201)
      .then((response: { body: { login: string; password: string; userId: string } }) => {
        let { login, password, userId } = response.body
        expect(login).toBeTruthy()
        expect(login.length).toBe(64)
        expect(password).toBeTruthy()
        expect(password.length).toBe(64)
        expect(userId).toBeTruthy()
        expect(userId.length).toBe(64)
      })
  })
})
