// ~~/src/types/Payment.ts

// define type
export type Payment = {
  decoded?: {
    destination: string
    expiry: number
    num_satoshis: number
    payment_hash: string
    timestamp: number
  }
  pay_req?: string
  payment_error?: string
  payment_route?: {
    total_amt?: number
    total_amt_msat?: number
    total_fees?: number
  }
}

export default Payment
