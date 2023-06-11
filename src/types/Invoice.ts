// ~~/src/types/Invoice.ts

// define type
export type Invoice = {
  add_index: string
  payment_request: string
  r_hash: { type: 'Buffer'; data: number[] }
  // optional attributes
  amt?: number // amount
  description?: string // memo
  expire_time?: number // in seconds, defaults to 86400 (1d)
  ispaid?: boolean
  timestamp?: number // unix timestamp in seconds
  type?: 'user_invoice'
  userid?: string
}

export default Invoice
