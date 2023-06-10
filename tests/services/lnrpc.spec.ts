// ~~/tests/lnrpc.spec.ts

// imports
import { Creds, LightningService, LnRpc } from 'τ/services/lnrpc'
import { beforeAll, describe, expect, it } from 'vitest'
import { lnd } from 'τ/configs'
import { promisify } from 'node:util'

let lnsvc: LightningService

beforeAll(() => {
  lnsvc = new LnRpc.Lightning(`${lnd.host}:${lnd.port}`, Creds)
})

describe('getInfo', () => {
  it('responds with information from lightning node daemon', async () => {
    let info = await promisify(lnsvc.getInfo).bind(lnsvc)({})
    expect(info.chains.length).toBe(1)
    expect(info.chains[0].chain).toBe('bitcoin')
    expect(info.chains[0].network).toBe('regtest')
  })
})

describe('listChannels', () => {
  it('list channels from lnd', async () => {
    let data: { channels: string[] } = await promisify(lnsvc.listChannels).bind(lnsvc)({})
    expect(data.channels.length).toBe(0)
  })
})
