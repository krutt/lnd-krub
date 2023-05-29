// ~~/src/server/routes/chainInfo.route.ts

// imports
import type { LNDKrubRequest, LNDKrubRouteFunc } from '@/server/routes'
import type { LightningService } from '@/server/services/lightning'
import type { Response } from 'express'

// TODO: Relocate code
// import configs from '@/configs'
// let lightningDescribeGraph = {}
// function updateDescribeGraph() {
//   console.log('updateDescribeGraph()')
//   lightning.describeGraph({ include_unannounced: true }, function (err, response) {
//     if (!err) lightningDescribeGraph = response
//     console.log('updated graph')
//   })
// }
// if (configs.enableUpdateDescribeGraph) {
//   updateDescribeGraph()
//   setInterval(updateDescribeGraph, 120000)
// }

export default (_: LightningService): LNDKrubRouteFunc =>
  /**
   *
   * @param request
   * @param response
   * @returns
   */
  async (request: LNDKrubRequest, response: Response) => {
    console.log('/getchaninfo', [request.id])
    // @ts-ignore
    if (lightningDescribeGraph && lightningDescribeGraph.edges) {
      // @ts-ignore
      for (const edge of lightningDescribeGraph.edges) {
        if (edge.channel_id == request.params.chanid) {
          return response.send(JSON.stringify(edge, null, 2))
        }
      }
    }
    return response.send('')
  }
