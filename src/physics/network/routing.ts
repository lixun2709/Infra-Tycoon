import type { Connection, InfraNode } from '../../store/infraTypes'

export interface RouteResult {
  exists: boolean
  path: string[]
  connectionIds: string[]
  totalLatencyMs: number
  totalPacketLoss: number
}

/**
 * findShortestPath
 * High-performance, self-contained Dijkstra pathfinder tailored for real-time 
 * network physics simulations. Computes optimal routes using traffic-engineering weights.
 */
export function findShortestPath(
  startNodeId: string,
  endNodeId: string,
  nodes: InfraNode[],
  connections: Connection[]
): RouteResult {
  if (startNodeId === endNodeId) {
    return {
      exists: true,
      path: [startNodeId],
      connectionIds: [],
      totalLatencyMs: 0.0,
      totalPacketLoss: 0.0
    }
  }

  // Build high-performance adjacency list
  // Map node ID to list of { adjacentNodeId: string, connection: Connection }
  const adj = new Map<string, Array<{ node: string; conn: Connection }>>()
  const activeNodes = new Set<string>()

  nodes.forEach(n => {
    activeNodes.add(n.id)
    adj.set(n.id, [])
  })

  // Add connections to the adjacency list
  connections.forEach(conn => {
    if (!conn || conn.status === 'blocked' || conn.isBlackholed) return
    const u = conn.startNodeId
    const v = conn.endNodeId

    // Only route through active, non-blocked nodes
    if (!activeNodes.has(u) || !activeNodes.has(v)) return

    const startNode = nodes.find(n => n.id === u)
    const endNode = nodes.find(n => n.id === v)
    if (startNode?.isBlackholed || endNode?.isBlackholed) return

    adj.get(u)!.push({ node: v, conn })
    adj.get(v)!.push({ node: u, conn })
  })

  // Dijkstra data structures
  const dist = new Map<string, number>()
  const prev = new Map<string, { nodeId: string; connId: string }>()
  const visited = new Set<string>()

  dist.set(startNodeId, 0)

  while (true) {
    let u: string | null = null
    let minDist = Infinity

    // Find unvisited node with minimum distance
    activeNodes.forEach(nodeId => {
      if (!visited.has(nodeId)) {
        const d = dist.get(nodeId) ?? Infinity
        if (d < minDist) {
          minDist = d
          u = nodeId
        }
      }
    })

    // If no reachable nodes left, or we reached destination
    if (u === null || minDist === Infinity || u === endNodeId) {
      break
    }

    visited.add(u)

    const neighbors = adj.get(u) || []
    for (const neighbor of neighbors) {
      const v = neighbor.node
      if (visited.has(v)) continue

      const conn = neighbor.conn
      const latency = conn.latencyMs ?? 1.0
      const loss = conn.packetLoss ?? 0.0
      const throughput = conn.throughputGbps ?? 0.0
      const capacity = conn.bandwidthGbps || 10.0
      const utilization = Math.min(1.0, throughput / capacity)

      // Traffic-engineered weight formula
      const weight = latency * (1.0 + loss * 5.0) + (utilization * 2.0)
      const alt = minDist + weight

      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt)
        prev.set(v, { nodeId: u, connId: conn.id })
      }
    }
  }

  // Path reconstruction
  if (!dist.has(endNodeId) || dist.get(endNodeId) === Infinity) {
    return {
      exists: false,
      path: [],
      connectionIds: [],
      totalLatencyMs: 999.0,
      totalPacketLoss: 1.0
    }
  }

  const path: string[] = []
  const connectionIds: string[] = []
  let curr = endNodeId

  while (curr !== startNodeId) {
    const edge = prev.get(curr)
    if (!edge) break
    path.push(curr)
    connectionIds.push(edge.connId)
    curr = edge.nodeId
  }

  path.push(startNodeId)
  path.reverse()
  connectionIds.reverse()

  // Calculate compounds
  let totalLatencyMs = 0.0
  let compoundSuccessRate = 1.0

  connectionIds.forEach(connId => {
    const conn = connections.find(c => c.id === connId)
    if (conn) {
      totalLatencyMs += conn.latencyMs ?? 1.0
      const loss = conn.packetLoss ?? 0.0
      compoundSuccessRate *= (1.0 - loss)
    }
  })

  return {
    exists: true,
    path,
    connectionIds,
    totalLatencyMs: Number(totalLatencyMs.toFixed(1)),
    totalPacketLoss: Number((1.0 - compoundSuccessRate).toFixed(4))
  }
}
