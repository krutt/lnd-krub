/* ~~/src/server/stores/user.ts */

// imports
import type { AddInvoiceResponse } from '@/types'
import BigNumber from 'bignumber.js'
import type { Invoice, Payment, UserAuth, UserMetadata } from '@/types'
import { TagData, decode as decodeBOLT11 } from 'bolt11'
import { bitcoin, cache, lightning } from '@/server/stores'
import { createHash, randomBytes } from 'node:crypto'
import { decodeRawHex } from '@/cypher'
import { lookupInvoice } from '@/server/stores/invoice'
import { obtainLock, releaseLock } from '@/server/stores/lock'
import { promisify } from 'node:util'
import { fetchPaymentAmountPaid, setPaymentAmountPaid } from './payment'

export const addAddress = async (address: string, userId: string): Promise<'OK'> =>
  await cache.set('bitcoin_address_for_' + userId, address)

export const clearBalanceCache = async (userId: string): Promise<number> =>
  await cache.del('balance_for_' + userId)

export const createUser = async (): Promise<{
  login: string
  password: string
  userId: string
}> => {
  let login = randomBytes(10).toString('hex')
  let password = randomBytes(10).toString('hex')
  let userId = randomBytes(24).toString('hex')
  await saveUserToDatabase(login, password, userId)
  return { login, password, userId }
}

export const fetchUserAuth = async (userId: string): Promise<UserAuth> => {
  let tokens: string[] = await Promise.all([
    cache.get('access_token_for_' + userId),
    cache.get('refresh_token_for_' + userId),
  ])
  return { accessToken: tokens[0], refreshToken: tokens[1] }
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
 * @param {String} bolt11
 * @param {Object} decodedInvoice
 * @returns {Promise<void>}
 */
export const lockFunds = async (bolt11: string, decodedInvoice: any, userId: string) => {
  let locked = {
    pay_req: bolt11,
    amount: +decodedInvoice.num_satoshis,
    timestamp: Math.floor(+new Date() / 1000),
  }
  return cache.rpush('locked_payments_for_' + userId, JSON.stringify(locked))
}

/**
 *
 * @param {string} authorization "Bearer ..." like string
 * @returns
 */
export const loadUserIdByAuthorization = async (authorization: string): Promise<string | null> => {
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
      payment.timestamp = +payment.decoded.timestamp
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

export const getUserInvoices = async (userId: string, limit: number = 0): Promise<Invoice[]> => {
  let range = await cache.lrange('userinvoices_for_' + userId, 0, -1)
  if (limit) range = range.slice(-limit)
  let result = []
  for (let item of range) {
    let payment = JSON.parse(item) as Payment
    let decoded = decodeBOLT11(payment.payment_request)
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
    let { payment_hash } = payment as Payment
    let amountPaid = await fetchPaymentAmountPaid(payment_hash)
    if (amountPaid) payment.ispaid = true
    if (!payment.ispaid) {
      if (decoded && decoded.timestamp > +new Date() / 1000 - 3600 * 24 * 5) {
        // if invoice is not too old we query lnd to find out if its paid
        payment.ispaid = await syncInvoicePaid(payment_hash, userId)
        amountPaid = await fetchPaymentAmountPaid(payment_hash) // since we have just saved it
      }
    }
    payment.amt = amountPaid && amountPaid > decoded.satoshis ? amountPaid : decoded.satoshis
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

export const saveUserMetadata = async (metadata: UserMetadata, userId: string): Promise<'OK'> =>
  await cache.set('metadata_for_' + userId, JSON.stringify(metadata))

export const saveUserInvoice = async (response: AddInvoiceResponse, userId: string) => {
  let decoded = decodeBOLT11(response.payment_request)
  let paymentHash: TagData | null = null
  for (let tag of decoded.tags) {
    if (tag.tagName === 'payment_hash') {
      paymentHash = tag.data
    }
  }

  await cache.set('payment_hash_' + paymentHash, userId)
  return await cache.rpush('userinvoices_for_' + userId, JSON.stringify(response))
}

const saveUserToDatabase = async (login: string, password: string, userId: string) => {
  let key = 'user_' + login + '_' + hashPassword(password)
  await cache.set(key, userId)
}

export const syncInvoicePaid = async (paymentHash: string, userId: string) => {
  let invoice = await lookupInvoice(paymentHash)
  // @ts-ignore
  if (!invoice || !invoice.settled) return false
  // @ts-ignore
  const ispaid = invoice.settled // TODO: start using `state` instead as its future proof, and this one might get deprecated
  if (ispaid) {
    // so invoice was paid after all
    await setPaymentAmountPaid(
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
 * @param {String} bolt11 encoded payment request
 * @returns {Promise<void>}
 */
export const unlockFunds = async (bolt11: string, userId: string) => {
  let payments = await getLockedPayments(userId)
  let saveBack = []
  for (let paym of payments) {
    if (paym.pay_req !== bolt11) {
      saveBack.push(paym)
    }
  }
  await cache.del('locked_payments_for_' + userId)
  for (let payment of saveBack) {
    await cache.rpush('locked_payments_for_' + userId, JSON.stringify(payment))
  }
}

export const watchAddress = async (address: string) =>
  !address
    ? void 0
    : await bitcoin.importAddress(address, address).catch(() => {
        /* Regtest throws "Only legacy wallets are supported for this command" */
      })
