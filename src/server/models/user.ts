// ~~/src/server/models/user.ts

// imports
import BigNumber from 'bignumber.js'
import type { Payment, User } from '@/types'
import bolt11, { TagData } from 'bolt11'
import { bitcoin, cache, lightning } from '@/server/models'
import { createHash, randomBytes } from 'node:crypto'
import { decodeRawHex } from '@/cypher'
import { obtainLock, releaseLock } from '@/server/models/lock'
import { promisify } from 'node:util'

// static cache:
let _invoice_ispaid_cache = {}

export const addAddress = async (address: string, userId: string) => {
  await cache.set('bitcoin_address_for_' + userId, address)
}

export const clearBalanceCache = async (userId: string) => {
  return cache.del('balance_for_' + userId)
}

export const createUser = async (): Promise<{
  login: string
  password: string
  userId: string
}> => {
  let buffer = randomBytes(10)
  let login = buffer.toString('hex')

  buffer = randomBytes(10)
  let password = buffer.toString('hex')

  buffer = randomBytes(24)
  let userId = buffer.toString('hex')

  await saveUserToDatabase(login, password, userId)
  return { login, password, userId }
}

export const fetchAccessTokens = async (userId: string): Promise<User> => {
  let tokens: string[] = await Promise.all([
    cache.get('access_token_for_' + userId),
    cache.get('refresh_token_for_' + userId),
  ])
  return { access_token: tokens[0], refresh_token: tokens[1] }
}

const generateAccessTokens = async (userId: string): Promise<void> => {
  let access_token = randomBytes(20).toString('hex')
  let refresh_token = randomBytes(20).toString('hex')

  await cache.set('user_id_for_' + access_token, userId)
  await cache.set('user_id_for_' + refresh_token, userId)
  await cache.set('access_token_for_' + userId, access_token)
  await cache.set('refresh_token_for_' + userId, refresh_token)
}

export const getUserAddress = async (userId: string) => {
  return await cache.get('bitcoin_address_for_' + userId)
}

/**
 * LNDKrub no longer relies on redis balance as source of truth, this is
 * more a cache now. See `calculateBalance()` to get correct balance.
 *
 * @returns {Promise<number>} Balance available to spend
 */
export const getBalance = async (userId: string) => {
  let balance = parseInt(await cache.get('balance_for_' + userId)) * 1
  if (!balance) {
    balance = await calculateBalance(userId)
    await saveBalance(balance, userId)
  }
  return balance
}

/**
 * Accounts for all possible transactions in user's account and
 * sums their amounts.
 *
 * @returns {Promise<number>} Balance available to spend
 */
export const calculateBalance = async (userId: string) => {
  let balance = 0
  let userinvoices = await getUserInvoices(userId)

  for (let invo of userinvoices) {
    if (invo && invo.ispaid) {
      balance += +invo.amt
    }
  }

  let transactions = await getTransactions(userId)
  for (let transaction of transactions) {
    if (transaction.type === 'bitcoind_tx') {
      // topup
      balance += new BigNumber(transaction.amount).multipliedBy(100000000).toNumber()
    } else {
      balance -= +transaction.value
    }
  }

  let lockedPayments = await getLockedPayments(userId)
  for (let paym of lockedPayments) {
    // locked payments are processed in scripts/process-locked-payments.js
    // @ts-ignore
    balance -= +paym.amount + /* feelimit */ Math.floor(paym.amount * forwardFee)
  }

  return balance
}

export const getLockedPayments = async (userId: string) => {
  let payments = await cache.lrange('locked_payments_for_' + userId, 0, -1)
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

/**
 * Adds invoice to a list of user's locked payments.
 * Used to calculate balance till the lock is lifted (payment is in
 * determined state - succeded or failed).
 *
 * @param {String} paymentRequest
 * @param {Object} decodedInvoice
 * @returns {Promise<void>}
 */
export const lockFunds = async (paymentRequest: string, decodedInvoice: any, userId: string) => {
  let doc = {
    pay_req: paymentRequest,
    amount: +decodedInvoice.num_satoshis,
    timestamp: Math.floor(+new Date() / 1000),
  }
  return cache.rpush('locked_payments_for_' + userId, JSON.stringify(doc))
}

/**
 *
 * @param {string} authorization "Bearer ..." like string
 * @returns
 */
export const loadUserByAuthorization = async (authorization: string): Promise<string | null> => {
  if (!authorization) return null
  let access_token = authorization.replace('Bearer ', '')
  let userId = await cache.get('user_id_for_' + access_token)
  return userId ? userId : null
}

export const loadUserByRefreshToken = async (refresh_token: string): Promise<string | null> => {
  let userId = await cache.get('user_id_for_' + refresh_token)
  await generateAccessTokens(userId)
  return userId ? userId : null
}

export const loadUserByLoginAndPassword = async (
  login: string,
  password: string
): Promise<string | null> => {
  let userId = await cache.get('user_' + login + '_' + hashPassword(password))
  await generateAccessTokens(userId)
  return userId ? userId : null
}

/**
 * Asks LND for new address, and imports it to bitcoind
 *
 * @returns {Promise<void>}
 */
export const generateUserAddress = async (userId: string): Promise<void> => {
  let lockKey: string = 'generating_address_' + userId
  if (!(await obtainLock(lockKey))) {
    // someone's already generating address
    return null
  }
  let address = await getUserAddress(userId)
  if (!address) {
    let request: { address: string } = await promisify(lightning.newAddress)
      .bind(lightning)({ type: 0 })
      .catch(() => {
        console.error('LND failure when trying to generate new address')
      })
    address = request.address
    if (!address) return
    await addAddress(address, userId)
    if (bitcoin) {
      let info: object | null = await bitcoin.getAddressInfo(address).catch(err => {
        console.error(err)
        return null
      })
      if (!info) {
        await bitcoin.importAddress(address, address).catch(err => console.error(err))
      }
    }
  }
  await releaseLock(lockKey)
}

/**
 * Returning onchain txs for user's address that are less than 3 confs
 *
 * @returns {Promise<Array>}
 */
export const getPendingTransactions = async (userId: string) => {
  let address = await getOrGenerateAddress(userId)
  let transactions = await listTransactions()
  return transactions.result.filter(
    transaction =>
      transaction.confirmations < 3 &&
      transaction.address === address &&
      ['receive', 'send'].includes(transaction.category)
  )
}

export const getOrGenerateAddress = async (userId: string) => {
  let addr = await getUserAddress(userId)
  if (!addr) {
    await generateUserAddress(userId)
    addr = await getUserAddress(userId)
  }
  if (!addr) throw new Error('cannot get transactions: no onchain address assigned to user')
  return addr
}

/**
 * Doent belong here, FIXME
 * @see Invo._getIsPaymentHashMarkedPaidInDatabase
 * @see Invo.getIsMarkedAsPaidInDatabase
 */
export const getPaymentHashPaid = async (paymentHash: string): Promise<number> => {
  return parseInt(await cache.get('ispaid_' + paymentHash))
}

/**
 * User's onchain txs that are >= 3 confs
 * Queries bitcoind RPC.
 *
 * @returns {Promise<Array>}
 */
export const getTransactions = async (userId: string) => {
  let address = await getOrGenerateAddress(userId)
  let transactions = await listTransactions()
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

  let range = await cache.lrange('txs_for_' + userId, 0, -1)
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

export const getUserInvoices = async (userId: string, limit: number = 0) => {
  if (!userId) throw new Error('UserId missing.')
  let range = await cache.lrange('userinvoices_for_' + userId, 0, -1)
  if (limit) {
    range = range.slice(-limit)
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
      } else if (tag.tagName === 'payment_hash') {
        // @ts-ignore
        payment.payment_hash = tag.data
      }
    }

    let paymentHashPaidAmountSat = 0
    let { payment_hash } = payment as Payment
    if (_invoice_ispaid_cache[payment_hash]) {
      // static cache hit
      payment.ispaid = true
      paymentHashPaidAmountSat = _invoice_ispaid_cache[payment_hash]
    } else {
      // static cache miss, asking redis cache
      paymentHashPaidAmountSat = await getPaymentHashPaid(payment_hash)
      if (paymentHashPaidAmountSat) payment.ispaid = true
    }

    if (!payment.ispaid) {
      if (decoded && decoded.timestamp > +new Date() / 1000 - 3600 * 24 * 5) {
        // if invoice is not too old we query lnd to find out if its paid
        payment.ispaid = await syncInvoicePaid(payment_hash, userId)
        paymentHashPaidAmountSat = await getPaymentHashPaid(payment_hash) // since we have just saved it
      }
    } else {
      _invoice_ispaid_cache[payment_hash] = paymentHashPaidAmountSat
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
export const getUserIdByPaymentHash = async (paymentHash: string): Promise<string> => {
  return await cache.get('payment_hash_' + paymentHash)
}

const hashPassword = (value: string) => createHash('sha256').update(value).digest().toString('hex')

/**
 * Simple caching for bitcoin.request('listtransactions', ['*', 100500, 0, true]);
 * since its too much to fetch from bitcoind every time
 *
 * @returns {Promise<*>}
 * @private
 */
const listTransactions = async () => {
  let result = []
  if (!!bitcoin) {
    result = await bitcoin
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
        let transactions = await cache.get('listtransactions')
        return !transactions ? [] : JSON.parse(transactions)
      })
  } else if (!!lightning) {
    console.log('get chain transactions via lnd')
    let transactions = await promisify(lightning.getTransactions)
      .bind(lightning)({})
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
    await cache.setex('listtransactions', 5 * 60 * 1000, JSON.stringify(result))
  }
  return { result }
}

export const lookupInvoice = async (paymentHash: string) => {
  return await promisify(lightning.lookupInvoice)
    .bind(lightning)({
      r_hash_str: paymentHash,
    })
    .catch(err => {
      console.error(err)
      return {}
    })
}

/**
 * LNDKrub no longer relies on redis balance as source of truth, this is
 * more a cache now. See `getCalculatedBalance()` to get correct balance.
 *
 * @param balance
 */
export const saveBalance = async (balance: number, userId: string) => {
  const key = 'balance_for_' + userId
  await cache.set(key, balance)
  await cache.expire(key, 1800)
}

export const saveMetadata = async (metadata: any, userId: string): Promise<'OK'> =>
  await cache.set('metadata_for_' + userId, JSON.stringify(metadata))

export const savePaidLndInvoice = async (doc: any, userId: string): Promise<number> =>
  await cache.rpush('txs_for_' + userId, JSON.stringify(doc))

export const saveUserInvoice = async (doc: any, userId: string) => {
  let decoded = bolt11.decode(doc.payment_request)
  let paymentHash: TagData | null = null
  for (let tag of decoded.tags) {
    if (tag.tagName === 'payment_hash') {
      paymentHash = tag.data
    }
  }

  await cache.set('payment_hash_' + paymentHash, userId)
  return await cache.rpush('userinvoices_for_' + userId, JSON.stringify(doc))
}

const saveUserToDatabase = async (login: string, password: string, userId: string) => {
  let key = 'user_' + login + '_' + hashPassword(password)
  await cache.set(key, userId)
}

/**
 * Doent belong here, FIXME
 * @see Invo._setIsPaymentHashPaidInDatabase
 * @see Invo.markAsPaidInDatabase
 */
export const setPaymentHashPaid = async (paymentHash: string, settleAmountSat) => {
  return await cache.set('ispaid_' + paymentHash, settleAmountSat)
}

export const syncInvoicePaid = async (paymentHash: string, userId: string) => {
  const invoice = await lookupInvoice(paymentHash)
  // @ts-ignore
  const ispaid = invoice.settled // TODO: start using `state` instead as its future proof, and this one might get deprecated
  if (ispaid) {
    // so invoice was paid after all
    await setPaymentHashPaid(
      paymentHash,
      // @ts-ignore
      invoice.amt_paid_msat ? Math.floor(invoice.amt_paid_msat / 1000) : invoice.amt_paid_sat
    )
    await clearBalanceCache(userId)
  }
  return ispaid
}

/**
 * Strips specific payreq from the list of locked payments
 * @param paymentRequest
 * @returns {Promise<void>}
 */
export const unlockFunds = async (paymentRequest: string, userId: string) => {
  let payments = await getLockedPayments(userId)
  let saveBack = []
  for (let paym of payments) {
    if (paym.pay_req !== paymentRequest) {
      saveBack.push(paym)
    }
  }
  await cache.del('locked_payments_for_' + userId)
  for (let doc of saveBack) {
    await cache.rpush('locked_payments_for_' + userId, JSON.stringify(doc))
  }
}

export const watchAddress = async (address: string) =>
  !address
    ? void 0
    : await bitcoin.importAddress(address, address).catch(() => {
        /* Regtest throws "Only legacy wallets are supported for this command" */
      })