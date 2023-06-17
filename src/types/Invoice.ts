// ~~/src/types/Invoice.ts

// define type
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
  pay_req?: string // bluewallet: client backwards compatibility
  payment_hash: string
  payment_request: string
  r_hash: Buffer
  timestamp?: number // unix timestamp in seconds
  type: 'faucet' | 'user_invoice'
}

export type InvoiceJSON = Invoice & {
  r_hash: {
    type: 'Buffer'
    data: Array<number>
  }
}

export default Invoice
