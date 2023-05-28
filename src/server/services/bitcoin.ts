// ~~/src/server/services/bitcoin.ts

// imports
import 'dotenv/config'
import jayson, { HttpClient } from 'jayson/promise'
import { parse as parseUrl } from 'url'

let rpc = parseUrl(process.env.BTC_RPC_URL)
// @ts-ignore
rpc.timeout = 15000

export type BitcoinService = HttpClient
export const service: BitcoinService = jayson.client.http(rpc)
export default service
