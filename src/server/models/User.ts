// ~~/src/server/models/User.ts

// imports
import BigNumber from 'bignumber.js'
import type { BitcoinService } from '@/server/services/bitcoin'
import type { CacheService } from '@/server/services/cache'
import type { LightningService } from '@/server/services/lightning'
import Lock from './Lock'
import type { Payment } from '@/types'

import bolt11 from 'bolt11'
import { createHash, randomBytes } from 'crypto'
import { decodeRawHex } from '@/cypher'
import { promisify } from 'node:util'

// static cache:
let _invoice_ispaid_cache = {}

export class User {
  access_token?: string
  balance: number
  bitcoin: BitcoinService
  cache: CacheService
  lightning: LightningService
  login?: string
  password?: string
  refresh_token?: string
  userid?: string

  /**
   *
   * @param {BitcoinService} bitcoin
   * @param {CacheService} cache
   * @param {LightningService} lightning
   */
  constructor(bitcoin: BitcoinService, cache: CacheService, lightning: LightningService) {
    this.bitcoin = bitcoin
    this.cache = cache
    this.lightning = lightning
    this.balance = 0
  }

  // private methods

  _generateTokens = async () => {
    this.access_token = randomBytes(20).toString('hex')
    this.refresh_token = randomBytes(20).toString('hex')

    await this.cache.set('userid_for_' + this.access_token, this.userid)
    await this.cache.set('userid_for_' + this.refresh_token, this.userid)
    await this.cache.set('access_token_for_' + this.userid, this.access_token)
    await this.cache.set('refresh_token_for_' + this.userid, this.refresh_token)
  }

  _hash = (value: string) => createHash('sha256').update(value).digest().toString('hex')

  /**
   * Simple caching for this.bitcoin.request('listtransactions', ['*', 100500, 0, true]);
   * since its too much to fetch from bitcoind every time
   *
   * @returns {Promise<*>}
   * @private
   */
  _listtransactions = async () => {
    let result = []
    if (!!this.bitcoin) {
      result = await this.bitcoin
        .listTransactions()
        .then(data =>
          data.result.map(transaction => {
            let { address, amount, category, confirmations } = transaction
            let time = transaction.blocktime || transaction.time
            return { address, amount, category, confirmations, time }
          })
        )
        .catch(async err => {
          console.warn('listtransactions error:', err)
          let transactions = await this.cache.get('listtransactions')
          return !transactions ? [] : JSON.parse(transactions)
        })
    } else if (!!this.lightning) {
      console.log('get chain transactions via lnd')
      let transactions = await promisify(this.lightning.getTransactions)
        .bind(this.lightning)({})
        .then((data: { transactions: Array<any> }) => data.transactions)
        .catch(err => {
          console.error(err)
          return []
        })
      // on lightning incoming transactions have no labels
      // for now filter out known labels to reduce transactions
      transactions
        .filter(txn => {
          return txn.label !== 'external' && !txn.label.includes('openchannel')
        })
        .map(txn => {
          let decoded = decodeRawHex(txn.raw_tx_hex)
          decoded.outputs.map(output => {
            result.push({
              // mark all as received, since external is filtered out
              category: 'receive',
              confirmations: txn.num_confirmations,
              amount: Number(output.value),
              address: output.scriptPubKey.addresses[0],
              time: txn.time_stamp,
            })
          })
        })
    }
    if (result.length > 0) {
      await this.cache.setex('listtransactions', 5 * 60 * 1000, JSON.stringify(result))
    }
    return { result }
  }

  _saveUserToDatabase = async () => {
    let key = 'user_' + this.login + '_' + this._hash(this.password)
    await this.cache.set(key, this.userid)
  }

  // public methods

  addAddress = async (address: string) => {
    await this.cache.set('bitcoin_address_for_' + this.userid, address)
  }

  clearBalanceCache = async () => {
    return this.cache.del('balance_for_' + this.userid)
  }

  create = async () => {
    let buffer = randomBytes(10)
    let login = buffer.toString('hex')

    buffer = randomBytes(10)
    let password = buffer.toString('hex')

    buffer = randomBytes(24)
    let userid = buffer.toString('hex')
    this.login = login
    this.password = password
    this.userid = userid

    await this._saveUserToDatabase()
  }

  getAccessToken = () => {
    return this.access_token
  }

  getAddress = async () => {
    return await this.cache.get('bitcoin_address_for_' + this.userid)
  }

  /**
   * LNDKrub no longer relies on redis balance as source of truth, this is
   * more a cache now. See `this.getCalculatedBalance()` to get correct balance.
   *
   * @returns {Promise<number>} Balance available to spend
   */
  getBalance = async () => {
    let balance = parseInt(await this.cache.get('balance_for_' + this.userid)) * 1
    if (!balance) {
      balance = await this.getCalculatedBalance()
      await this.saveBalance(balance)
    }
    return balance
  }

  /**
   * Accounts for all possible transactions in user's account and
   * sums their amounts.
   *
   * @returns {Promise<number>} Balance available to spend
   */
  getCalculatedBalance = async () => {
    let calculatedBalance = 0
    let userinvoices = await this.getUserInvoices()

    for (let invo of userinvoices) {
      if (invo && invo.ispaid) {
        calculatedBalance += +invo.amt
      }
    }

    let txs = await this.getTxs()
    for (let tx of txs) {
      if (tx.type === 'bitcoind_tx') {
        // topup
        calculatedBalance += new BigNumber(tx.amount).multipliedBy(100000000).toNumber()
      } else {
        calculatedBalance -= +tx.value
      }
    }

    let lockedPayments = await this.getLockedPayments()
    for (let paym of lockedPayments) {
      // locked payments are processed in scripts/process-locked-payments.js
      // @ts-ignore
      calculatedBalance -= +paym.amount + /* feelimit */ Math.floor(paym.amount * forwardFee)
    }

    return calculatedBalance
  }

  getUserId = () => {
    return this.userid
  }

  getLockedPayments = async () => {
    let payments = await this.cache.lrange('locked_payments_for_' + this.userid, 0, -1)
    let result = []
    for (let paym of payments) {
      let json
      try {
        json = JSON.parse(paym)
        result.push(json)
      } catch (_) {}
    }

    return result
  }

  getLogin = () => {
    return this.login
  }

  getPassword = () => {
    return this.password
  }

  getRefreshToken = () => {
    return this.refresh_token
  }

  /**
   * Adds invoice to a list of user's locked payments.
   * Used to calculate balance till the lock is lifted (payment is in
   * determined state - succeded or failed).
   *
   * @param {String} paymentRequest
   * @param {Object} decodedInvoice
   * @returns {Promise<void>}
   */
  lockFunds = async (paymentRequest: string, decodedInvoice: any) => {
    let doc = {
      pay_req: paymentRequest,
      amount: +decodedInvoice.num_satoshis,
      timestamp: Math.floor(+new Date() / 1000),
    }
    return this.cache.rpush('locked_payments_for_' + this.userid, JSON.stringify(doc))
  }

  /**
   *
   * @param {string} authorization "Bearer ..." like string
   * @returns
   */
  loadByAuthorization = async (authorization: string) => {
    if (!authorization) return false
    let access_token = authorization.replace('Bearer ', '')
    let userid = await this.cache.get('userid_for_' + access_token)

    if (userid) {
      this.userid = userid
      return true
    }

    return false
  }

  loadByRefreshToken = async (refresh_token: string) => {
    let userid = await this.cache.get('userid_for_' + refresh_token)
    if (userid) {
      this.userid = userid
      await this._generateTokens()
      return true
    }
    return false
  }

  loadByLoginAndPassword = async (login: string, password: string) => {
    let userid = await this.cache.get('user_' + login + '_' + this._hash(password))
    if (userid) {
      this.userid = userid
      this.login = login
      this.password = password
      await this._generateTokens()
      return true
    }
    return false
  }

  /**
   * Asks LND for new address, and imports it to bitcoind
   *
   * @returns {Promise<void>}
   */
  generateAddress = async (): Promise<void> => {
    let lock = new Lock(this.cache, 'generating_address_' + this.userid)
    if (!(await lock.obtainLock())) {
      // someone's already generating address
      return
    }
    let address = await this.getAddress()
    if (!address) {
      let request: { address: string } = await promisify(this.lightning.newAddress)
        .bind(this.lightning)({ type: 0 })
        .catch(() => {
          console.error('LND failure when trying to generate new address')
        })
      address = request.address
      if (!address) return
      await this.addAddress(address)
      if (this.bitcoin) {
        let info: object | null = await this.bitcoin.getAddressInfo(address).catch(err => {
          console.error(err)
          return null
        })
        if (!info) {
          await this.bitcoin.importAddress(address, address).catch(err => console.error(err))
        }
      }
    }
    await lock.releaseLock()
  }

  /**
   * Returning onchain txs for user's address that are less than 3 confs
   *
   * @returns {Promise<Array>}
   */
  getPendingTransactions = async () => {
    let address = await this.getOrGenerateAddress()
    let transactions = await this._listtransactions()
    return transactions.result.filter(
      transaction =>
        transaction.confirmations < 3 &&
        transaction.address === address &&
        ['receive', 'send'].includes(transaction.category)
    )
  }

  getOrGenerateAddress = async () => {
    let addr = await this.getAddress()
    if (!addr) {
      await this.generateAddress()
      addr = await this.getAddress()
    }
    if (!addr) throw new Error('cannot get transactions: no onchain address assigned to user')
    return addr
  }

  /**
   * Doent belong here, FIXME
   * @see Invo._getIsPaymentHashMarkedPaidInDatabase
   * @see Invo.getIsMarkedAsPaidInDatabase
   */
  getPaymentHashPaid = async (paymentHash: string): Promise<number> => {
    return parseInt(await this.cache.get('ispaid_' + paymentHash))
  }

  /**
   * User's onchain txs that are >= 3 confs
   * Queries bitcoind RPC.
   *
   * @returns {Promise<Array>}
   */
  getTxs = async () => {
    let address = await this.getOrGenerateAddress()
    let transactions = await this._listtransactions()
    let result = transactions.result
      .filter(
        transaction =>
          transaction.confirmations >= 3 &&
          transaction.address === address &&
          transaction.category === 'receive'
      )
      .map(transaction => {
        transaction.type = 'bitcoind_tx'
        return transaction
      })

    let range = await this.cache.lrange('txs_for_' + this.userid, 0, -1)
    for (let item of range) {
      let payment = JSON.parse(item) as Payment
      payment.type = 'paid_invoice'

      // for internal invoices it might not have properties `payment_route`  and `decoded`...
      if (payment.payment_route) {
        payment.fee = +payment.payment_route.total_fees
        payment.value = +payment.payment_route.total_fees + +payment.payment_route.total_amt
        if (
          payment.payment_route.total_amt_msat &&
          payment.payment_route.total_amt_msat / 1000 !== +payment.payment_route.total_amt
        ) {
          // okay, we have to account for MSAT
          payment.value =
            +payment.payment_route.total_fees +
            Math.max(
              // @ts-ignore
              parseInt(payment.payment_route.total_amt_msat / 1000),
              +payment.payment_route.total_amt
            ) +
            1 // extra sat to cover for msats, as external layer (clients) dont have that resolution
        }
      } else {
        payment.fee = 0
      }
      if (payment.decoded) {
        payment.timestamp = payment.decoded.timestamp
        payment.memo = payment.decoded.description
      }
      if (payment.payment_preimage) {
        payment.payment_preimage = Buffer.from(payment.payment_preimage, 'hex').toString('hex')
      }
      // removing unsued by client fields to reduce size
      delete payment.payment_error
      delete payment.payment_route
      delete payment.pay_req
      delete payment.decoded
      result.push(payment)
    }

    return result
  }

  getUserInvoices = async (limit?: string) => {
    let range = await this.cache.lrange('userinvoices_for_' + this.userid, 0, -1)
    if (limit && !isNaN(parseInt(limit))) {
      range = range.slice(parseInt(limit) * -1)
    }
    let result = []
    for (let item of range) {
      let payment = JSON.parse(item) as Payment
      let decoded = bolt11.decode(payment.payment_request)
      payment.description = ''
      for (let tag of decoded.tags) {
        if (tag.tagName === 'description') {
          try {
            // @ts-ignore
            payment.description += decodeURIComponent(tag.data)
          } catch (_) {
            payment.description += tag.data
          }
        }
        if (tag.tagName === 'payment_hash') {
          // @ts-ignore
          payment.payment_hash = tag.data
        }
      }

      let paymentHashPaidAmountSat = 0
      if (_invoice_ispaid_cache[payment.payment_hash]) {
        // static cache hit
        payment.ispaid = true
        paymentHashPaidAmountSat = _invoice_ispaid_cache[payment.payment_hash]
      } else {
        // static cache miss, asking redis cache
        paymentHashPaidAmountSat = await this.getPaymentHashPaid(payment.payment_hash)
        if (paymentHashPaidAmountSat) payment.ispaid = true
      }

      if (!payment.ispaid) {
        if (decoded && decoded.timestamp > +new Date() / 1000 - 3600 * 24 * 5) {
          // if invoice is not too old we query lnd to find out if its paid
          payment.ispaid = await this.syncInvoicePaid(payment.payment_hash)
          paymentHashPaidAmountSat = await this.getPaymentHashPaid(payment.payment_hash) // since we have just saved it
        }
      } else {
        _invoice_ispaid_cache[payment.payment_hash] = paymentHashPaidAmountSat
      }

      payment.amt =
        // @ts-ignore
        paymentHashPaidAmountSat && parseInt(paymentHashPaidAmountSat) > decoded.satoshis
          ? // @ts-ignore
            parseInt(paymentHashPaidAmountSat)
          : decoded.satoshis
      payment.expire_time = 3600 * 24
      // ^^^default; will keep for now. if we want to un-hardcode it - it should be among tags (`expire_time`)
      payment.timestamp = decoded.timestamp
      payment.type = 'user_invoice'
      result.push(payment)
    }

    return result
  }

  /**
   * Doent belong here, FIXME
   */
  getUseridByPaymentHash = async (paymentHash: string): Promise<string> => {
    return await this.cache.get('payment_hash_' + paymentHash)
  }

  lookupInvoice = async (paymentHash: string) => {
    return await promisify(this.lightning.lookupInvoice)
      .bind(this.lightning)({
        r_hash_str: paymentHash,
      })
      .catch(err => {
        console.error(err)
        return {}
      })
  }

  /**
   * LNDKrub no longer relies on redis balance as source of truth, this is
   * more a cache now. See `this.getCalculatedBalance()` to get correct balance.
   *
   * @param balance
   */
  saveBalance = async (balance: number) => {
    const key = 'balance_for_' + this.userid
    await this.cache.set(key, balance)
    await this.cache.expire(key, 1800)
  }

  saveMetadata = async (metadata: any): Promise<'OK'> =>
    await this.cache.set('metadata_for_' + this.userid, JSON.stringify(metadata))

  savePaidLndInvoice = async (doc: any): Promise<number> =>
    await this.cache.rpush('txs_for_' + this.userid, JSON.stringify(doc))

  saveUserInvoice = async (doc: any) => {
    let decoded = bolt11.decode(doc.payment_request)
    let payment_hash
    for (let tag of decoded.tags) {
      if (tag.tagName === 'payment_hash') {
        payment_hash = tag.data
      }
    }

    await this.cache.set('payment_hash_' + payment_hash, this.userid)
    return await this.cache.rpush('userinvoices_for_' + this.userid, JSON.stringify(doc))
  }

  /**
   * Doent belong here, FIXME
   * @see Invo._setIsPaymentHashPaidInDatabase
   * @see Invo.markAsPaidInDatabase
   */
  setPaymentHashPaid = async (paymentHash: string, settleAmountSat) => {
    return await this.cache.set('ispaid_' + paymentHash, settleAmountSat)
  }

  syncInvoicePaid = async (payment_hash: string) => {
    const invoice = await this.lookupInvoice(payment_hash)
    // @ts-ignore
    const ispaid = invoice.settled // TODO: start using `state` instead as its future proof, and this one might get deprecated
    if (ispaid) {
      // so invoice was paid after all
      await this.setPaymentHashPaid(
        payment_hash,
        // @ts-ignore
        invoice.amt_paid_msat ? Math.floor(invoice.amt_paid_msat / 1000) : invoice.amt_paid_sat
      )
      await this.clearBalanceCache()
    }
    return ispaid
  }

  /**
   * Strips specific payreq from the list of locked payments
   * @param paymentRequest
   * @returns {Promise<void>}
   */
  unlockFunds = async (paymentRequest: string) => {
    let payments = await this.getLockedPayments()
    let saveBack = []
    for (let paym of payments) {
      if (paym.pay_req !== paymentRequest) {
        saveBack.push(paym)
      }
    }

    await this.cache.del('locked_payments_for_' + this.userid)
    for (let doc of saveBack) {
      await this.cache.rpush('locked_payments_for_' + this.userid, JSON.stringify(doc))
    }
  }

  watchAddress = async (address: string) => {
    // if (!address) return
    // if (!!this.bitcoin) {
    //   return await this.bitcoin.request('importaddress', [address, address, false])
    // }
  }
}

export default User
