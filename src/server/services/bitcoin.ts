// ~~/src/server/services/bitcoin.ts

// imports
import { bitcoind } from '@/configs'
import jayson, { HttpClient } from 'jayson/promise'
import { parse as parseUrl } from 'url'

let rpc = parseUrl(bitcoind.rpc)
// @ts-ignore
rpc.timeout = 15000

export type BitcoinService = HttpClient
export const service: BitcoinService = jayson.client.http(rpc)
export default service
