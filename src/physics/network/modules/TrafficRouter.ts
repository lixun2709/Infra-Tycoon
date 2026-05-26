import type { Connection, InfraNode } from '../../../store/infraTypes'
import type { AdjacencyMap, NetworkDemand } from '../types'
import { NetworkRouteCache } from '../routing'

export class TrafficRouter {
  /**
   * Routes traffic and aggregates bandwidth demand across the network connections via Dijkstra SSSP.
   */
  public static routeTraffic(
    nodes: InfraNode[],
    connections: Connection[],
    demands: NetworkDemand[],
    adjMap: AdjacencyMap,
    topologyHash: number
  ): Map<string, number> {
    const demandMap = new Map(demands.map(d => [d.nodeId, d]))
    const accumulatedThroughput = new Map<string, number>()
    
    connections.forEach(c => accumulatedThroughput.set(c.id, 0.0))

    nodes.forEach(sourceNode => {
      // Only route demands for running, active device nodes
      if (sourceNode.type === 'rack' || sourceNode.type === 'cooling' || sourceNode.type === 'network') return
      if (sourceNode.systemState === 'off') return
      if (sourceNode.isBlackholed) return

      const demand = demandMap.get(sourceNode.id)?.demandGbps ?? 0
      if (demand <= 0) return

      let bestPathConnIds: string[] = []
      let minCost = Infinity

      // Find possible targets
      const possibleTargets = nodes.filter(n => {
        if (n.id === sourceNode.id) return false
        if (n.type === 'rack' || n.type === 'cooling') return false
        if (n.systemState === 'off') return false
        if (n.isBlackholed) return false

        // Match preferred routing destinations
        if (sourceNode.type === 'compute' || sourceNode.type === 'backup') {
          return n.type === 'storage' || n.type === 'load_balancer'
        } else if (sourceNode.type === 'storage') {
          return n.type === 'backup' || n.type === 'network'
        }
        return n.type === 'network' || n.type === 'compute'
      })

      // If no preferred target, fallback to any other non-rack, non-cooling node
      const targetsToTry = possibleTargets.length > 0
        ? possibleTargets
        : nodes.filter(n => n.id !== sourceNode.id && n.type !== 'rack' && n.type !== 'cooling' && n.systemState !== 'off' && !n.isBlackholed)

      // Obtain the globally cached Single-Source Shortest Path (SSSP) tree for this source node
      const tree = NetworkRouteCache.getShortestPathTree(sourceNode.id, nodes, connections, adjMap, topologyHash)

      targetsToTry.forEach(target => {
        const route = tree.getPathTo(target.id)
        if (route.exists && route.totalLatencyMs < minCost) {
          minCost = route.totalLatencyMs
          bestPathConnIds = route.connectionIds
        }
      })

      // Route the traffic load along the shortest path
      if (bestPathConnIds.length > 0) {
        bestPathConnIds.forEach(connId => {
          accumulatedThroughput.set(connId, (accumulatedThroughput.get(connId) || 0) + demand)
        })
      }
    })

    return accumulatedThroughput
  }
}
