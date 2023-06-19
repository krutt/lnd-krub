// ~~/src/types/Invoice.ts

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
  timestamp?: number // unix timestamp in seconds
  type: 'faucet' | 'user_invoice'
}

export type InvoiceJSON = Invoice & {
  r_hash: {
    data: number[]
    type: 'Buffer'
  }
}

export default Invoice
