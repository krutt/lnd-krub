// ~~/src/server/models/Graph.ts

// imports
import type { LightningService } from '@/server/services/lightning'
import type { Redis as RedisService } from 'ioredis'
import { promisify } from 'node:util'

export class Graph {
  _lightning: LightningService
  _redis: RedisService

  /**
   *
   * @param {LightningService} lightning
   * @param {RedisService} redis
   */
  constructor(lightning: LightningService, redis: RedisService) {
    this._lightning = lightning
    this._redis = redis
  }

  async describe(): Promise<any> {
    let graph = JSON.parse(await this._redis.get('lightning_describe_graph'))
    if (!graph) {
      let graph: { edges: any } = await promisify(this._lightning.describeGraph)
        .bind(this._lightning)({ include_unannounced: true })
        .catch(console.error)
      if (graph) await this._redis.setex('lightning_describe_graph', 120000, JSON.stringify(graph))
    }
    return graph
  }

  async release(): Promise<void> {
    await this._redis.del('lightning_describe_graph')
  }
}

export default Graph
