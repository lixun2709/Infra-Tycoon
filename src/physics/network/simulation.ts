import type { InfraNode, Connection } from '../../store/infraTypes'
import { calculateNodeDemand } from './demand'
import { buildAdjacencyMap } from './topology'
import { resolveCongestion } from './congestion'

export interface NetworkTickResult {
  connections: Connection[]
  newlyInfectedNodeIds: string[]
}

/**
 * simulateNetwork
 * Completely decoupled, deterministic, replay-safe, and worker-thread safe network simulation tick.
 * Orchestrates:
 * 1. Demand Phase: calculates node bandwidth requirements and applies incident profiles.
 * 2. Topology Phase: constructs high-performance adjacency maps.
 * 3. Congestion & Propagation Phase: routes traffic via Dijkstra and simulates malware spreading.
 */
export function simulateNetwork(
  nodes: InfraNode[],
  connections: Connection[],
  networkLoad: number,
  dt = 1.0
): NetworkTickResult {
  // Phase 1: Demand Phase
  const demands = nodes.map(node => calculateNodeDemand(node, networkLoad))

  // Phase 2: Topology Phase
  const adjMap = buildAdjacencyMap(connections)

  // Phase 3: Congestion & Propagation Phase
  const { updatedConnections, newlyInfectedNodeIds } = resolveCongestion(nodes, connections, demands, adjMap, dt)

  return {
    connections: updatedConnections,
    newlyInfectedNodeIds
  }
}
