/* ~~/src/types/Payment.ts */

// imports
import { PayReq } from './PayReq'

// define types
export type MockPayment = {
  decoded: {
    timestamp: number
  }
  fee: number
  memo: string
  pay_req: string
  type: 'faucet' | 'paid_invoice'
  value: number
}

export type Payment = {
  amt: number
  decoded: PayReq
  description: string
  expire_time: number
  fee: number
  ispaid: boolean
  memo: string
  pay_req: string
  payment_error: string
  payment_hash: string
  payment_preimage: string
  payment_request: string
  payment_route: {
    total_amt: number
    total_amt_msat: number
    total_fees: number
  }
  timestamp: number
  type: string
  value: number
}

export default Payment
