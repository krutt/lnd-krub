// ~~/src/types/Invoice.ts

// define type
export type Invoice = {
  add_index: string
  payment_request: string
  r_hash: Buffer
  // optional attributes
  amt?: number // amount
  description?: string // memo
  expire_time?: number // in seconds, defaults to 86400 (1d)
  ispaid?: boolean
  pay_req?: string // bluewallet: client backwards compatibility
  timestamp?: number // unix timestamp in seconds
  type?: 'faucet' | 'user_invoice'
  userid?: string
}

export type InvoiceJSON = Invoice & {
  r_hash: {
    type: 'Buffer'
    data: Array<number>
  }
}

export default Invoice
