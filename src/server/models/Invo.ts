// ~~/src/server/models/Invo.ts

// imports
import type { Invoice } from '@/types'
import type { CacheService } from '@/server/services/cache'
import type { LightningService } from '@/server/services/lightning'
import type { Tag } from '@/types'
import bolt11, { PaymentRequestObject, TagData } from 'bolt11'
import crypto from 'crypto'
import { promisify } from 'node:util'

export class Invo {
  // member vars
  _cache: CacheService
  _decoded?: Invoice
  _isPaid?: boolean
  _lightning: LightningService
  _paymentRequest?: string
  

  /**
   *
   * @param {CacheService} cache
   * @param {LightningService} lightning
   */
  constructor(cache: CacheService, lightning: LightningService) {
    this._cache = cache
    this._lightning = lightning
  }

  // private methods

  _getIsPaymentHashMarkedPaidInDatabase = async (paymentHash: TagData) => {
    return await this._cache.get('ispaid_' + paymentHash)
  }

  _setIsPaymentHashPaidInDatabase = async (paymentHash: TagData, settleAmountSat?: number) => {
    if (settleAmountSat) {
      return await this._cache.set('ispaid_' + paymentHash, settleAmountSat)
    } else {
      return await this._cache.del('ispaid_' + paymentHash)
    }
  }

  // public methods

  getIsMarkedAsPaidInDatabase = async () => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    let decoded: PaymentRequestObject = bolt11.decode(this._paymentRequest)
    let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
    let paymentHash: TagData = paymentTag?.data
    if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
    return await this._getIsPaymentHashMarkedPaidInDatabase(paymentHash)
  }

  getPreimage = async (): Promise<any> => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    let decoded: PaymentRequestObject = bolt11.decode(this._paymentRequest)
    let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
    let paymentHash: TagData = paymentTag?.data
    if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
    return await this._cache.get('preimage_for_' + paymentHash)
  }

  /**
   * Queries LND ofr all user invoices
   *
   * @return {Promise<array>}
   */
  listInvoices = async (): Promise<Array<Invoice>> => {
    return await promisify(this._lightning.listInvoices)
      .bind(this._lightning)({
        num_max_invoices: 99000111,
        reversed: true,
      })
      .catch(err => {
        console.error(err)
        return []
      })
  }

  makePreimageHex = (): string => {
    let buffer = crypto.randomBytes(32)
    return buffer.toString('hex')
  }

  markAsPaidInDatabase = async () => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    let decoded: PaymentRequestObject = bolt11.decode(this._paymentRequest)
    let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
    let paymentHash: TagData = paymentTag?.data
    if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
    return await this._setIsPaymentHashPaidInDatabase(paymentHash, decoded.satoshis)
  }

  markAsUnpaidInDatabase = async () => {
    if (!this._paymentRequest) throw new Error('BOLT11 payment request is not provided.')
    let decoded: PaymentRequestObject = bolt11.decode(this._paymentRequest)
    let paymentTag: Tag = decoded.tags.find((tag: Tag) => tag.tagName === 'payment_hash')
    let paymentHash: TagData = paymentTag?.data
    if (!paymentHash) throw new Error('Could not find payment hash in invoice tags')
    return await this._setIsPaymentHashPaidInDatabase(paymentHash)
  }

  savePreimage = async (preimageHex): Promise<void> => {
    let paymentHashHex = require('crypto')
      .createHash('sha256')
      .update(Buffer.from(preimageHex, 'hex'))
      .digest('hex')
    let key = 'preimage_for_' + paymentHashHex
    await this._cache.set(key, preimageHex)
    await this._cache.expire(key, 3600 * 24 * 30) // 1 month
  }

  setPaymentRequest = (paymentRequest: string) => {
    this._paymentRequest = paymentRequest
  }
}

export default Invo
