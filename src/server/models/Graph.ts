// ~~/src/server/models/Graph.ts

// imports
import type { CacheService } from '@/server/services/cache'
import type { LightningService } from '@/server/services/lightning'
import { promisify } from 'node:util'

export class Graph {
  _cache: CacheService
  _lightning: LightningService

  /**
   *
   * @param {CacheService} cache
   * @param {LightningService} lightning
   */
  constructor(cache: CacheService, lightning: LightningService) {
    this._cache = cache
    this._lightning = lightning
  }

  async describe(): Promise<any> {
    let graph = JSON.parse(await this._cache.get('lightning_describe_graph'))
    if (!graph) {
      let graph: { edges: any } = await promisify(this._lightning.describeGraph)
        .bind(this._lightning)({ include_unannounced: true })
        .catch(console.error)
      if (graph) await this._cache.setex('lightning_describe_graph', 120000, JSON.stringify(graph))
    }
    return graph
  }

  async release(): Promise<void> {
    await this._cache.del('lightning_describe_graph')
  }
}

export default Graph
