import type { Connection, InfraNode } from '../../store/infraTypes'
import type { AdjacencyMap } from './types'
import type { NetworkDemand } from './types'

import { TrafficRouter } from './modules/TrafficRouter'
import { MalwarePropagator } from './modules/MalwarePropagator'
import { QoSEngine } from './modules/QoSEngine'

export interface CongestionResult {
  updatedConnections: Connection[]
  newlyInfectedNodeIds: string[]
}

/**
 * resolveCongestion
 * Orchestrates network throughput via dynamic Dijkstra routing paths,
 * lateral infection propagation, and multi-queue QoS packet delays/loss.
 * 
 * Delegates to purely functional enterprise modules.
 */
export function resolveCongestion(
  nodes: InfraNode[],
  connections: Connection[],
  demands: NetworkDemand[],
  adjMap: AdjacencyMap,
  topologyHash: number,
  dt = 1.0
): CongestionResult {
  
  // 1. Compile Graph Adjacency & Compute Flow Aggregation via Shortest Paths
  const accumulatedThroughput = TrafficRouter.routeTraffic(nodes, connections, demands, adjMap, topologyHash)

  // 2. Incident Lateral Propagation Model
  const newlyInfectedNodeIds = MalwarePropagator.propagate(nodes, adjMap, dt)

  // 3. Resolve congestion metrics on links based on accumulated Dijkstra flows
  const updatedConnections = QoSEngine.resolveMetrics(connections, accumulatedThroughput, nodes, demands, dt)

  return { updatedConnections, newlyInfectedNodeIds }
}
