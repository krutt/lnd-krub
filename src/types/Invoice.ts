/* ~~/src/types/Invoice.ts */

// define types
export type AddInvoiceResponse = {
  add_index: string
  payment_request: string
  r_hash: Buffer
  // optional attributes
  pay_req?: string // bluewallet: client backwards compatibility
}

export type Invoice = {
  add_index: string
  amt: number // amount
  creation_date: string // unix-timestamp
  description: string // memo
  destination: string
  expiry: number
  expire_time: number // in seconds, defaults to 86400 (1d)
  ispaid: boolean
  num_satoshis: string
  num_msat: string
  payment_hash: string
  payment_request: string
  r_hash: Buffer
  state: 'OPEN' | 'SETTLED'
  timestamp?: number // unix timestamp in seconds
  type: 'faucet' | 'user_invoice'
}

// export type InvoiceExtended = {
//   route_hints: string[],
//   htlcs: string[],
//   features: Object[],
//   memo: string,
//   r_preimage: Buffer
//   r_hash: Buffer
//   value: string
//   settled: boolean
//   creation_date: string
//   settle_date: string
//   payment_request: string // bolt11
//   description_hash: Buffer
//   expiry: string
//   fallback_addr: string
//   cltv_expiry: string
//   private: boolean
//   add_index: string
//   settle_index: string
//   amt_paid: string
//   amt_paid_sat: string  // number-like
//   amt_paid_msat: string // number-like
//   state: 'OPEN' | 'SETTLED'
//   value_msat: string // number-like
//   is_keysend: boolean
// }

export type InvoiceJSON = Invoice & {
  r_hash: {
    data: number[]
    type: 'Buffer'
  }
}

export default Invoice
