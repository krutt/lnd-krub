/* ~~/src/tests/services/bitcoin.spec.ts */

// imports
import { BitcoinService } from '@/server/services/bitcoin'
import { beforeAll, describe, expect, it } from 'vitest'

let bitcoin: BitcoinService

beforeAll(() => {
  bitcoin = new BitcoinService()
})

describe('get network information', () => {
  it('responds with node information', async () => {
    let { error, id, result } = await bitcoin.getNetworkInfo()
    expect(error).toBeFalsy()
    expect(id).toBeTruthy()
    expect(id).toBeTypeOf('string')
    expect(id.length).toBe(36)
    expect(id.replaceAll('-', '').length).toBe(32)
    expect(result).toBeTypeOf('object')
    let { connections, networkactive, networks, version, warnings } = result
    expect(connections).toBeTypeOf('number')
    expect(connections).toBe(0)
    expect(version).toBeTruthy()
    expect(version).toBeTypeOf('number')
    expect([240000, 250000, 260000]).toContain(version)
    expect(networkactive).toBeTruthy()
    expect(networkactive).toBeTypeOf('boolean')
    expect(networks).toBeTruthy()
    expect(networks).toBeTypeOf('object') // array
    let defaultNetworks: string[] = ['ipv4', 'ipv6', 'onion', 'i2p', 'cjdns']
    expect(networks.map((network: { name: string }) => network.name)).toStrictEqual(defaultNetworks)
    expect(warnings).toBeTypeOf('string')
    expect(warnings).toBe('')
  })
})

describe('list transactions for all', () => {
  it('responds with all available transactions', async () => {
    let { error, id, result } = await bitcoin.listTransactions()
    expect(error).toBeFalsy()
    expect(id).toBeTruthy()
    expect(id).toBeTypeOf('string')
    expect(id.length).toBe(36)
    expect(id.replaceAll('-', '').length).toBe(32)
    expect(result).toBeTypeOf('object') // array
    expect(result.length).toBeTypeOf('number')
    expect(result.length).toBeGreaterThan(0)
  })
})
