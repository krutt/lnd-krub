// ~~/tests/lndkrub/chainnelInfo.spec.ts

// imports
import type { UserAuth } from '@/types'
import lndkrub from '@/index'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'

let authHeaders: { Authorization: string }
let channelIds: string[] = []

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
  await supertest(lndkrub)
    .get('/channels')
    .set(authHeaders)
    .expect(200)
    .expect('Content-Type', /json/)
    .then((response: { body: { channels: { chan_id: string }[] } }) => {
      let { channels } = response.body
      channels.map(channel => channelIds.push(channel.chan_id))
    })
})

describe('GET /getchaninfo/:channelId', () => {
  it('responds with channel information for given channel id', async () => {
    for (let channelId of channelIds) {
      await supertest(lndkrub)
        .get(`/getchaninfo/${channelId}`)
        .set(authHeaders)
        .expect(200)
        .expect('Content-Type', /json/)
        .then((response: { body: { channel_id: string } }) => {
          let { channel_id } = response.body
          expect(channel_id).toStrictEqual(channelId)
          // TODO: other validations
        })
    }
  })
})
