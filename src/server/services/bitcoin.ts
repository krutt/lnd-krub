/* ~~/src/server/services/bitcoin.ts */

// imports
import { URL } from 'node:url'
import { bitcoind } from '@/configs'
import jayson, { HttpClient } from 'jayson/promise'

export class BitcoinService {
  _rpc: HttpClient
  _url: URL

  /**
   * JSON-RPC client for bitcoind service
   * @param url customize bitcoind url
   * @param timeout timeout per each json-rpc request
   */
  constructor(url?: string, timeout: number = 15000) {
    this._url = new URL(url || bitcoind.url)
    let { hostname, port } = this._url
    let auth = !!this._url.password
      ? `${this._url.username}:${this._url.password}`
      : `${this._url.username}`
    let rpcConfigs = { auth, hostname, port, timeout }
    this._rpc = jayson.client.http(rpcConfigs)
  }

  // methods

  createWallet = async (walletName: string) => this._rpc.request('createwallet', [walletName])

  generateBlock = async (address: string) => await this._rpc.request('generateblock', [address, []])

  generateToAddress = async (blocks: number, address: string) =>
    await this._rpc.request('generatetoaddress', [blocks, address])

  getAddressInfo = async (address: string) => await this._rpc.request('getaddressinfo', [address])

  getBlockchainInfo = async () => await this._rpc.request('getblockchaininfo', [])

  getNetworkInfo = async () => await this._rpc.request('getnetworkinfo', [])

  getNewAddress = async () => await this._rpc.request('getnewaddress', [])

  getWalletInfo = async () => await this._rpc.request('getwalletinfo', [])

  getRawMempool = async () => await this._rpc.request('getrawmempool', [])

  importAddress = async (address: string, label: string, rescan: boolean = false) =>
    await this._rpc.request('importaddress', [address, label, rescan])

  listTransactions = async (
    label: string = '*',
    count: number = 100500,
    skip: number = 0,
    includeWatchonly: boolean = true
  ) => await this._rpc.request('listtransactions', [label, count, skip, includeWatchonly])

  sendToAddress = async (address: string, amount: number) =>
    await this._rpc.request('sendtoaddress', [address, amount])
}

export default BitcoinService
