/* ~~/src/types */

export type Channel = {
  capacity: number
  capacity_btc: number
  local: number
  local_balance: number
  name?: string // well known
  remote_pubkey: string
  size: number
  total: number
}

export default Channel
