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

    // Precompute target sets to eliminate O(N^2) array allocations in the hot routing loop
    const storageAndLoadBalancers: InfraNode[] = []
    const backupAndNetwork: InfraNode[] = []
    const networkAndCompute: InfraNode[] = []
    const fallbackTargets: InfraNode[] = []

    nodes.forEach(n => {
      if (n.type === 'rack' || n.type === 'cooling') return
      if (n.systemState === 'off') return
      if (n.isBlackholed) return

      fallbackTargets.push(n)

      if (n.type === 'storage' || n.type === 'load_balancer') {
        storageAndLoadBalancers.push(n)
      }
      if (n.type === 'backup' || n.type === 'network') {
        backupAndNetwork.push(n)
      }
      if (n.type === 'network' || n.type === 'compute') {
        networkAndCompute.push(n)
      }
    })

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
      let possibleTargets: InfraNode[] = []
      if (sourceNode.type === 'compute' || sourceNode.type === 'backup') {
        possibleTargets = storageAndLoadBalancers
      } else if (sourceNode.type === 'storage') {
        possibleTargets = backupAndNetwork
      } else {
        possibleTargets = networkAndCompute
      }

      const targetsToTry = possibleTargets.length > 0
        ? possibleTargets.filter(n => n.id !== sourceNode.id)
        : fallbackTargets.filter(n => n.id !== sourceNode.id)

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
