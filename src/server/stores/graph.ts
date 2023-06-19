/* ~~/src/server/stores/graph.ts */

// imports
import type { Graph } from '@/types'
import { cache, lightning } from '@/server/stores'
import { promisify } from 'node:util'

// constants
const KEY: string = 'lightning_describe_graph'
const TTL: number = 120000

/**
 * Asks the LND instance to describe graphical connections to other lightning nodes on the network
 * Fetches the graph description either from LRU cached response or fresh from the daemon
 * @returns {Graph}
 */
export const describeLightningGraph = async (): Promise<Graph> => {
  let graph = JSON.parse(await cache.get(KEY))
  if (!graph) {
    let graph: { edges: any } = await promisify(lightning.describeGraph)
      .bind(lightning)({ include_unannounced: true })
      .catch(console.error)
    if (graph) await cache.setex(KEY, TTL, JSON.stringify(graph))
  }
  return graph
}

/**
 * Unsets the cached lightning graph from LND instance
 * @returns {Number}
 */
export const releaseLightningGraph = async (): Promise<number> => await cache.del(KEY)
