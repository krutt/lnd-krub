// ~~/src/server/stores/invoice.ts

// imports
import type { AddInvoiceResponse, Invoice, PayReq, Tag } from '@/types'
import { PaymentRequestObject, TagData, decode as decodeBOLT11 } from 'bolt11'
import { cache, lightning } from '@/server/stores'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'

export const createInvoice = async (
  amount: number,
  memo: string,
  r_preimage: string
): Promise<AddInvoiceResponse | null> =>
  await promisify(lightning.addInvoice)
    .bind(lightning)({
      memo,
      expiry: 3600 * 24,
      r_preimage,
      value: amount,
    })
    .catch(console.error)

/**
 * Decode given payment request string using service denoded by rpc-endpoint, or by `bolt11` library
 * if `viaRpc` parameter is set to `false`.
 * @param {String} bolt11
 * @param {Boolean} viaRpc, defaults to `true`
 * @returns
 */
export const decodePaymentRequest = async (
  bolt11: string,
  viaRpc: boolean = true
): Promise<PayReq | null> => {
  return viaRpc
    ? await promisify(lightning.decodePayReq)
        .bind(lightning)({ pay_req: bolt11 })
        .catch(console.error)
    : decodeBOLT11(bolt11) // TODO: make compatible with PayReq type
}

export const getIsMarkedAsPaidInDatabase = async (bolt11: string) => {
  if (!bolt11) throw new Error('BOLT11 payment request is not provided.')
  let decoded: PaymentRequestObject = decodeBOLT11(bolt11)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await getIsPaymentHashMarkedPaidInDatabase(paymentHash)
}

const getIsPaymentHashMarkedPaidInDatabase = async (paymentHash: TagData) => {
  return await cache.get('ispaid_' + paymentHash)
}

export const getPreimage = async (bolt11: string): Promise<string> => {
  if (!bolt11) throw new Error('BOLT11 payment request is not provided.')
  let decoded: PaymentRequestObject = decodeBOLT11(bolt11)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await cache.get('preimage_for_' + paymentHash)
}

/**
 * Queries LND ofr all user invoices
 *
 * @return {Promise<array>}
 */
export const listInvoices = async (): Promise<Array<Invoice>> => {
  return await promisify(lightning.listInvoices)
    .bind(lightning)({
      num_max_invoices: 99000111,
      reversed: true,
    })
    .catch(err => {
      console.error(err)
      return []
    })
}

export const lookupInvoice = async (paymentHash: string): Promise<Invoice | null> => {
  return await promisify(lightning.lookupInvoice)
    .bind(lightning)({ r_hash_str: paymentHash })
    .catch(console.error)
}

export const markAsPaidInDatabase = async (bolt11: string) => {
  let decoded: PaymentRequestObject = decodeBOLT11(bolt11)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await setIsPaymentHashPaidInDatabase(paymentHash, decoded.satoshis)
}

export const markAsUnpaidInDatabase = async (bolt11: string) => {
  let decoded: PaymentRequestObject = decodeBOLT11(bolt11)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await setIsPaymentHashPaidInDatabase(paymentHash)
}

export const savePreimage = async (preimageHex: string): Promise<void> => {
  let paymentHashHex = createHash('sha256').update(Buffer.from(preimageHex, 'hex')).digest('hex')
  let key = 'preimage_for_' + paymentHashHex
  await cache.setex(key, 3600 * 24 * 30, preimageHex) // 1 month
}

export const setIsPaymentHashPaidInDatabase = async (
  paymentHash: TagData,
  settleAmountSat?: number
) => {
  if (settleAmountSat) {
    return await cache.set('ispaid_' + paymentHash, settleAmountSat)
  } else {
    return await cache.del('ispaid_' + paymentHash)
  }
}
