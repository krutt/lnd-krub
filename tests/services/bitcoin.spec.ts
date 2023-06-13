/* ~~/src/tests/services/bitcoin.spec.ts */

// imports
import { service as bitcoin } from "./bitcoin"
import { describe, expect, it } from 'vitest'

describe('get network information', () => {
  it('responds with node information', async () => {
    let { error, id, result } = await bitcoin.request('getnetworkinfo', [])
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
    expect(version).toBe(240000)
    expect(networkactive).toBeTruthy()
    expect(networkactive).toBeTypeOf('boolean')
    expect(networks).toBeTruthy()
    expect(networks).toBeTypeOf('object') // array
    let defaultNetworks: string[] = ['ipv4', 'ipv6', 'onion', 'i2p', 'cjdns']
    expect(networks.map(network => network.name)).toStrictEqual(defaultNetworks)
    expect(warnings).toBeTypeOf('string')
    expect(warnings).toBe('')
  })
})