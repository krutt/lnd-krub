// ~~/src/server/services/bitcoin.ts

// imports
import { URL } from 'node:url'
import { bitcoind } from '@/configs'
import jayson, { HttpClient } from 'jayson/promise'

let url = new URL(bitcoind.rpc)
let { hostname, port } = url
let auth = !!url.password
  ? `${url.username}:${url.password}`
  : `${url.username}`
let rpc = { auth, hostname, port, timeout: 15000 }

export type BitcoinService = HttpClient
export const service: BitcoinService = jayson.client.http(url)
export default service
