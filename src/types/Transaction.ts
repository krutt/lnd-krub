// ~~/src/types/Transaction.ts

// define type
export type Transaction = {
  amount: string
  block_hash: string
  block_height: number
  dest_addresses: string[]
  label: string
  num_confirmations: number
  raw_tx_hex: string
  time_stamp: string
  total_fees: string
  tx_hash: string
  type?: string
  value?: number
}

export default Transaction
