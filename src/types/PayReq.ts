/* ~~/src/types/PayReq.ts */

// define types
type Feature = {
  is_known: boolean
  is_required: boolean
  name: 'multi-path-payments' | 'payment-addr' | 'tlv-onion' 
}

export type PayReq = {
  cltv_expiry: string
  description: string
  description_hash: string
  fallback_addr: string
  destination: string
  expiry: string
  features: { [key:string]: Feature }
  num_msat: string
  num_satoshis: string
  payment_addr: Buffer
  payment_hash: string
  route_hints: string[]
  timestamp: string
}

export type PayReqJSON = PayReq & {
  payment_addr: {
    data: number[]
    type: 'Buffer'
  }
}

export default PaymentRequest
