/* ~~/src/types/Graph.ts */

type Feature = {
  is_known: boolean
  is_required: boolean
  name:
    | 'anchors-zero-fee-htlc-tx'
    | 'data-loss-protect'
    | 'explicit-commitment-type'
    | 'gossip-queries'
    | 'multi-path-payments'
    | 'payment-addr'
    | 'script-enforced-lease'
    | 'shutdown-any-segwit'
    | 'static-remote-key'
    | 'tlv-onion'
    | 'upfront-shutdown-script'
}

type Policy = {
  disabled: boolean
  fee_base_msat: string
  fee_rate_milli_msat: string
  last_update: number
  min_htlc: string
  max_htlc_msat: string
  time_lock_delta: number
}

type Node = {
  addresses: string[]
  alias: string
  color: string
  features: { [key: string]: Feature }
  last_update: number
  pub_key: string
}

type Edge = {
  capacity: string
  chan_point: string
  channel_id: string
  last_update: number
  node1_policy: Policy
  node1_pub: string
  node2_policy: Policy
  node2_pub: string
}

export type Graph = {
  edges: Edge[]
  nodes: Node[]
}

export default Graph
