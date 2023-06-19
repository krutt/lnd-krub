/* ~~/src/types/Channel.ts */

export type Channel = {
  capacity: number
  capacity_btc: number
  local: number
  local_balance: number
  remote_pubkey: string
  size: number
  total: number
  // optional attributes
  name?: string // derived on the front-end using a list of well-known nodekeys
}

export default Channel
