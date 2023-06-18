/* ~~/src/server/stores/Dashblob.ts */

type Chain = {
  chain: 'bitcoin'
  network: 'mainnet' | 'regtest' | 'testnet'
}
type Feature = {
  is_known: boolean
  is_required: boolean
  name:
    | 'amp'
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

export type Dashblob = {
  uris: string[]
  chains: Chain[]
  features: { [key: string]: Feature }
  identity_pubkey: string
  alias: string
  num_pending_channels: number
  num_active_channels: number
  num_peers: number
  block_height: number
  block_hash: string
  synced_to_chain: boolean
  testnet: boolean
  best_header_timestamp: string
  version: string
  num_inactive_channels: number
  color: string
  synced_to_graph: boolean
  commit_hash: string
}

export default Dashblob
