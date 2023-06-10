// ~~/tests/lnrpc.spec.ts

// imports
import { LightningService, LnRpc, createLNDCreds } from 'τ/services/lnrpc'
import { beforeAll, describe, expect, it } from 'vitest'
import { lnd, lndTarget } from 'τ/configs'
import { promisify } from 'node:util'

let lnsvc: LightningService
let target: LightningService

beforeAll(() => {
  lnsvc = new LnRpc.Lightning(
    `${lnd.host}:${lnd.port}`,
    createLNDCreds(lnd.macaroonPath, lnd.tlsCertPath)
  )
  target = new LnRpc.Lightning(
    `${lndTarget.host}:${lndTarget.port}`,
    createLNDCreds(lndTarget.macaroonPath, lndTarget.tlsCertPath)
  )
})

describe('getInfo', () => {
  it('responds with information from lightning node daemon', async () => {
    let info = await promisify(lnsvc.getInfo).bind(lnsvc)({})
    expect(info.chains.length).toBe(1)
    expect(info.chains[0].chain).toBe('bitcoin')
    expect(info.chains[0].network).toBe('regtest')
  })
  it('responds with information from lightning node daemon from target', async () => {
    let info = await promisify(target.getInfo).bind(target)({})
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
  it('list channels from targeted lnd', async () => {
    let data: { channels: string[] } = await promisify(target.listChannels).bind(target)({})
    expect(data.channels.length).toBe(0)
  })
})
