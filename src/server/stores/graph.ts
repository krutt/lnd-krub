// ~~/src/server/stores/graph.ts

// imports
import type { Graph } from '@/types'
import { cache, lightning } from '@/server/stores'
import { promisify } from 'node:util'

export const describeLightningGraph = async (): Promise<Graph> => {
  let graph = JSON.parse(await cache.get('lightning_describe_graph'))
  if (!graph) {
    let graph: { edges: any } = await promisify(lightning.describeGraph)
      .bind(lightning)({ include_unannounced: true })
      .catch(console.error)
    if (graph) await cache.setex('lightning_describe_graph', 120000, JSON.stringify(graph))
  }
  return graph
}

export const releaseLightningGraph = async (): Promise<void> => {
  await cache.del('lightning_describe_graph')
}
