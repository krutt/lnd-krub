// ~~/src/server/models/User.ts

// imports
import BigNumber from 'bignumber.js'
import type { BitcoinService } from '@/server/services/bitcoin'
import type { LightningService } from '@/server/services/lightning'
import Lock from './Lock'
import type { Payment } from '@/types'
import type { Redis as RedisService } from 'ioredis'
import bolt11 from 'bolt11'
import { createHash, randomBytes } from 'crypto'
import { decodeRawHex } from '@/server/services/cypher'
import { promisify } from 'node:util'

// static cache:
let _invoice_ispaid_cache = {}

export class User {
  // member vars
  _access_token?: string
  _balance: number
  _bitcoin: BitcoinService
  _lightning: LightningService
  _login?: string
  _password?: string
  _refresh_token?: string
  _redis: RedisService
  _userid?: string

  /**
   *
   * @param {BitcoinService} bitcoin
   * @param {LightningService} lightning
   * @param {RedisService} redis
   */
  constructor(bitcoin: BitcoinService, lightning: LightningService, redis: RedisService) {
    this._bitcoin = bitcoin
    this._lightning = lightning
    this._redis = redis
    this._balance = 0
  }

  // private methods

  _generateTokens = async () => {
    this._access_token = randomBytes(20).toString('hex')
    this._refresh_token = randomBytes(20).toString('hex')

    await this._redis.set('userid_for_' + this._access_token, this._userid)
    await this._redis.set('userid_for_' + this._refresh_token, this._userid)
    await this._redis.set('access_token_for_' + this._userid, this._access_token)
    await this._redis.set('refresh_token_for_' + this._userid, this._refresh_token)
  }

  _hash = (value: string) => createHash('sha256').update(value).digest().toString('hex')

  /**
   * Simple caching for this._bitcoin.request('listtransactions', ['*', 100500, 0, true]);
   * since its too much to fetch from bitcoind every time
   *
   * @returns {Promise<*>}
   * @private
   */
  _listtransactions = async () => {
    let result = []
    if (!!this._bitcoin) {
      result = await this._bitcoin
        .request('listtransactions', ['*', 100500, 0, true])
        .then(data =>
          data.result.map(transaction => {
            let { address, amount, category, confirmations } = transaction
            let time = transaction.blocktime || transaction.time
            return { address, amount, category, confirmations, time }
          })
        )
        .catch(async err => {
          console.warn('listtransactions error:', err)
          let transactions = await this._redis.get('listtransactions')
          return !transactions ? [] : JSON.parse(transactions)
        })
    } else if (!!this._lightning) {
      console.log('get chain transactions via lnd')
      let transactions = await promisify(this._lightning.getTransactions)
        .bind(this._lightning)({})
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
          // @ts-ignore
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
      await this._redis.setex('listtransactions', 5 * 60 * 1000, JSON.stringify(result))
    }
    return { result }
  }

  _saveUserToDatabase = async () => {
    let key = 'user_' + this._login + '_' + this._hash(this._password)
    await this._redis.set(key, this._userid)
  }

  // public methods

  addAddress = async (address: string) => {
    await this._redis.set('bitcoin_address_for_' + this._userid, address)
  }

  clearBalanceCache = async () => {
    return this._redis.del('balance_for_' + this._userid)
  }

  create = async () => {
    let buffer = randomBytes(10)
    let login = buffer.toString('hex')

    buffer = randomBytes(10)
    let password = buffer.toString('hex')

    buffer = randomBytes(24)
    let userid = buffer.toString('hex')
    this._login = login
    this._password = password
    this._userid = userid

    await this._saveUserToDatabase()
  }

  getAccessToken = () => {
    return this._access_token
  }

  getAddress = async () => {
    return await this._redis.get('bitcoin_address_for_' + this._userid)
  }

  /**
   * LNDKrub no longer relies on redis balance as source of truth, this is
   * more a cache now. See `this.getCalculatedBalance()` to get correct balance.
   *
   * @returns {Promise<number>} Balance available to spend
   */
  getBalance = async () => {
    let balance = parseInt(await this._redis.get('balance_for_' + this._userid)) * 1
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
    return this._userid
  }

  getLockedPayments = async () => {
    let payments = await this._redis.lrange('locked_payments_for_' + this._userid, 0, -1)
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
    return this._login
  }

  getPassword = () => {
    return this._password
  }

  getRefreshToken = () => {
    return this._refresh_token
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
    return this._redis.rpush('locked_payments_for_' + this._userid, JSON.stringify(doc))
  }

  /**
   *
   * @param {string} authorization "Bearer ..." like string
   * @returns
   */
  loadByAuthorization = async (authorization: string) => {
    if (!authorization) return false
    let access_token = authorization.replace('Bearer ', '')
    let userid = await this._redis.get('userid_for_' + access_token)

    if (userid) {
      this._userid = userid
      return true
    }

    return false
  }

  loadByRefreshToken = async (refresh_token: string) => {
    let userid = await this._redis.get('userid_for_' + refresh_token)
    if (userid) {
      this._userid = userid
      await this._generateTokens()
      return true
    }
    return false
  }

  loadByLoginAndPassword = async (login: string, password: string) => {
    let userid = await this._redis.get('user_' + login + '_' + this._hash(password))
    if (userid) {
      this._userid = userid
      this._login = login
      this._password = password
      await this._generateTokens()
      return true
    }
    return false
  }

  /**
   * Asks LND for new address, and imports it to bitcoind
   *
   * @returns {Promise<any>}
   */
  generateAddress = async () => {
    let lock = new Lock('generating_address_' + this._userid, this._redis)
    if (!(await lock.obtainLock())) {
      // someone's already generating address
      return
    }

    let self = this
    return new Promise(function (resolve: Function, reject) {
      self._lightning.newAddress({ type: 0 }, async function (err, response) {
        if (err) return reject('LND failure when trying to generate new address')
        const addressAlreadyExists = await self.getAddress()
        if (addressAlreadyExists) {
          // one last final check, for a case of really long race condition
          resolve()
          return
        }
        await self.addAddress(response.address)
        // TODO: uncomment with logic change
        // if (config.bitcoind)
        //   self._bitcoin.request('importaddress', [response.address, response.address, false])
        resolve()
      })
    })
  }

  /**
   * Returning onchain txs for user's address that are less than 3 confs
   *
   * @returns {Promise<Array>}
   */
  getPendingTxs = async () => {
    let address = await this.getOrGenerateAddress()
    let transactions = await this._listtransactions()
    return transactions.result.filter(
      transaction =>
        transaction.confirmations < 3 &&
        transaction.address === address &&
        transaction.category === 'receive'
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
    return parseInt(await this._redis.get('ispaid_' + paymentHash))
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

    let range = await this._redis.lrange('txs_for_' + this._userid, 0, -1)
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
    let range = await this._redis.lrange('userinvoices_for_' + this._userid, 0, -1)
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
    return await this._redis.get('payment_hash_' + paymentHash)
  }

  lookupInvoice = async (paymentHash: string) => {
    return await promisify(this._lightning.lookupInvoice)
      .bind(this._lightning)({
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
    const key = 'balance_for_' + this._userid
    await this._redis.set(key, balance)
    await this._redis.expire(key, 1800)
  }

  saveMetadata = async (metadata: any): Promise<'OK'> =>
    await this._redis.set('metadata_for_' + this._userid, JSON.stringify(metadata))

  savePaidLndInvoice = async (doc: any): Promise<number> =>
    await this._redis.rpush('txs_for_' + this._userid, JSON.stringify(doc))

  saveUserInvoice = async (doc: any) => {
    let decoded = bolt11.decode(doc.payment_request)
    let payment_hash
    for (let tag of decoded.tags) {
      if (tag.tagName === 'payment_hash') {
        payment_hash = tag.data
      }
    }

    await this._redis.set('payment_hash_' + payment_hash, this._userid)
    return await this._redis.rpush('userinvoices_for_' + this._userid, JSON.stringify(doc))
  }

  /**
   * Doent belong here, FIXME
   * @see Invo._setIsPaymentHashPaidInDatabase
   * @see Invo.markAsPaidInDatabase
   */
  setPaymentHashPaid = async (paymentHash: string, settleAmountSat) => {
    return await this._redis.set('ispaid_' + paymentHash, settleAmountSat)
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

    await this._redis.del('locked_payments_for_' + this._userid)
    for (let doc of saveBack) {
      await this._redis.rpush('locked_payments_for_' + this._userid, JSON.stringify(doc))
    }
  }

  watchAddress = async address => {
    if (!address) return
    // TODO: uncomment with logic change
    // if (config.bitcoind)
    //   return this._bitcoin.request('importaddress', [address, address, false])
  }
}

export default User
