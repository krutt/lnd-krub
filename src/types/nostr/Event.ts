/* ~~/src/types/nostr/Event.ts */

/** Designates a verified event signature. */
export const verifiedSymbol = Symbol('verified')

export interface Event<K extends number = number> {
  kind: K
  tags: string[][]
  content: string
  created_at: number
  pubkey?: string
  id?: string
  sig?: string
  [verifiedSymbol]?: boolean
}

export default Event
