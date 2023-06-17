// ~~/src/server/models/invoice.ts

// imports
import type { Invoice } from '@/types'
import type { Tag } from '@/types'
import bolt11, { PaymentRequestObject, TagData } from 'bolt11'
import { cache, lightning } from '@/server/models'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'

export const createInvoice = async (
  amount: number,
  memo: string,
  r_preimage: string
): Promise<Invoice | void> => {
  return await promisify(lightning.addInvoice)
    .bind(lightning)({
      memo,
      expiry: 3600 * 24,
      r_preimage,
      value: amount,
    })
    .catch(console.error)
}

export const getIsMarkedAsPaidInDatabase = async (paymentRequest: string) => {
  if (!paymentRequest) throw new Error('BOLT11 payment request is not provided.')
  let decoded: PaymentRequestObject = bolt11.decode(paymentRequest)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await getIsPaymentHashMarkedPaidInDatabase(paymentHash)
}

const getIsPaymentHashMarkedPaidInDatabase = async (paymentHash: TagData) => {
  return await cache.get('ispaid_' + paymentHash)
}

export const getPreimage = async (paymentRequest: string): Promise<any> => {
  if (!paymentRequest) throw new Error('BOLT11 payment request is not provided.')
  let decoded: PaymentRequestObject = bolt11.decode(paymentRequest)
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

export const markAsPaidInDatabase = async (paymentRequest: string) => {
  let decoded: PaymentRequestObject = bolt11.decode(paymentRequest)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await setIsPaymentHashPaidInDatabase(paymentHash, decoded.satoshis)
}

export const markAsUnpaidInDatabase = async (paymentRequest: string) => {
  let decoded: PaymentRequestObject = bolt11.decode(paymentRequest)
  let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
  let paymentHash: TagData = paymentTag?.data
  if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
  return await setIsPaymentHashPaidInDatabase(paymentHash)
}

export const savePreimage = async (preimageHex): Promise<void> => {
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
