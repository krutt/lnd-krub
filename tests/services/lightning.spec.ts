// ~~/tests/lnrpc.spec.ts

// imports
import { LightningService } from '@/server/services/lightning'
import { beforeAll, describe, expect, it } from 'vitest'
import { externalLND } from 'τ/configs'
import { promisify } from 'node:util'
import { randomBytes } from 'crypto'

let lnsvc: LightningService
let lnext: LightningService

// types
type Invoice = {
  add_index: string
  payment_request: string
  r_hash: Buffer
}

beforeAll(() => {
  lnsvc = new LightningService()
  lnext = new LightningService(
    externalLND.host,
    externalLND.macaroonPath,
    externalLND.port,
    externalLND.tlsCertPath
  )
})

describe('call "addInvoice" via grpc to ⚡️ service and external ⚡️ service', () => {
  let expiry: number = 3600 * 24
  let memo: string = 'test'
  let r_preimage: string = randomBytes(32).toString('base64')
  let value: number = 100

  it('responds with invoice information added to ⚡️ service', async () => {
    let invoice = await promisify(lnsvc.addInvoice).bind(lnsvc)({ expiry, memo, value, r_preimage })
    expect(invoice).toBeTruthy()
    let { add_index, payment_request, r_hash } = invoice
    expect(add_index).toBeTruthy()
    expect(add_index).toBeTypeOf('string')
    expect(+add_index).toBeGreaterThan(0)
    expect(payment_request).toBeTruthy()
    expect(payment_request).toBeTypeOf('string')
    expect(payment_request.slice(0, 6)).toStrictEqual('lnbcrt') // regtest
    expect(r_hash).toBeTruthy()
    expect(r_hash).toBeTypeOf('object')
    expect(r_hash).toBeInstanceOf(Buffer)
    expect(r_hash.length).toBe(32)
  })
  it('responds with invoice information added to external ⚡️ service', async () => {
    let invoice = await promisify(lnext.addInvoice).bind(lnext)({ expiry, memo, r_preimage, value })
    expect(invoice).toBeTruthy()
    let { add_index, payment_request, r_hash } = invoice
    expect(add_index).toBeTruthy()
    expect(add_index).toBeTypeOf('string')
    expect(+add_index).toBeGreaterThan(0)
    expect(payment_request).toBeTruthy()
    expect(payment_request).toBeTypeOf('string')
    expect(payment_request.slice(0, 6)).toStrictEqual('lnbcrt') // regtest
    expect(r_hash).toBeTruthy()
    expect(r_hash).toBeTypeOf('object')
    expect(r_hash).toBeInstanceOf(Buffer)
    expect(r_hash.length).toBe(32)
  })
})

describe('call "decodePayReq" via grpc to ⚡️ service and external ⚡️ service', () => {
  let expiry: number = 3600 * 24
  let memo: string = 'test'
  let r_preimage: string = randomBytes(32).toString('base64')
  let value: number = 100

  let invoice: Invoice
  let invoice2: Invoice
  beforeAll(async () => {
    invoice = await promisify(lnsvc.addInvoice).bind(lnsvc)({ expiry, memo, value, r_preimage })
    invoice2 = await promisify(lnext.addInvoice).bind(lnext)({ expiry, memo, r_preimage, value })
  })

  it('responds with decoded information for given invoice from ⚡️ service', async () => {
    let decoded = await promisify(lnsvc.decodePayReq).bind(lnsvc)({
      pay_req: invoice.payment_request,
    })
    expect(decoded).toBeTruthy()
    let decodedExpiry = decoded.expiry
    let { description, num_satoshis } = decoded
    expect(decodedExpiry).toBeTypeOf('string')
    expect(+decodedExpiry).toBe(expiry)
    expect(description).toStrictEqual(memo)
    expect(num_satoshis).toBeTypeOf('string')
    expect(+num_satoshis).toBe(value)
  })
  it('responds with decoded information for given invoice from external ⚡️ service', async () => {
    let decoded = await promisify(lnext.decodePayReq).bind(lnext)({
      pay_req: invoice2.payment_request,
    })
    expect(decoded).toBeTruthy()
    let decodedExpiry = decoded.expiry
    let { description, num_satoshis } = decoded
    expect(decodedExpiry).toBeTypeOf('string')
    expect(+decodedExpiry).toBe(expiry)
    expect(description).toStrictEqual(memo)
    expect(num_satoshis).toBeTypeOf('string')
    expect(+num_satoshis).toBe(value)
  })
})

describe('call "getInfo" via grpc to ⚡️ service and external ⚡️ service', () => {
  it('responds with information from lightning node daemon from ⚡️ service', async () => {
    let info = await promisify(lnsvc.getInfo).bind(lnsvc)({})
    expect(info.chains.length).toBe(1)
    expect(info.chains[0].chain).toBe('bitcoin')
    expect(info.chains[0].network).toBe('regtest')
  })
  it('responds with information from lightning node daemon from external ⚡️ service', async () => {
    let info = await promisify(lnext.getInfo).bind(lnext)({})
    expect(info.chains.length).toBe(1)
    expect(info.chains[0].chain).toBe('bitcoin')
    expect(info.chains[0].network).toBe('regtest')
  })
})

describe('call "listChannels" via grpc to ⚡️ service and external ⚡️ service', () => {
  it('list channels from ⚡️ service', async () => {
    let data: { channels: string[] } = await promisify(lnsvc.listChannels).bind(lnsvc)({})
    expect(data.channels).toBeTruthy()
  })
  it('list channels from external ⚡️ service', async () => {
    let data: { channels: string[] } = await promisify(lnext.listChannels).bind(lnext)({})
    expect(data.channels).toBeTruthy()
  })
})

describe('call "newAddress" via grpc to ⚡️ service and external ⚡️ service', () => {
  it('responds with new address when requesting newAddress via ⚡️ service', async () => {
    let data: { address: string } = await promisify(lnsvc.newAddress).bind(lnsvc)({})
    expect(data).toBeTruthy()
    let { address } = data
    expect(address).toBeTruthy()
    expect(address).toBeTypeOf('string')
    expect(address.slice(0, 5)).toStrictEqual('bcrt1')
    expect(address.length).toBe(44)
  })
  it('responds with new address when requesting newAddress via external ⚡️ service', async () => {
    let data: { address: string } = await promisify(lnext.newAddress).bind(lnext)({})
    expect(data).toBeTruthy()
    let { address } = data
    expect(address).toBeTruthy()
    expect(address).toBeTypeOf('string')
    expect(address.slice(0, 5)).toStrictEqual('bcrt1')
    expect(address.length).toBe(44)
  })
})
