/* ~~/src/tests/services/bitcoin.ts */

// imports
import { URL } from 'node:url'
import { bitcoind } from 'τ/configs'
import jayson, { HttpClient } from 'jayson/promise'

let url = new URL(bitcoind.rpc)
let { hostname, port } = url
let auth = !!url.password
  ? `${url.username}:${url.password}`
  : `${url.username}`
let rpc = { auth, hostname, port, timeout: 15000 }

type BitcoinService = HttpClient
export const service: BitcoinService = jayson.client.http(rpc)
export default service
