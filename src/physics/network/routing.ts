import type { Connection, InfraNode } from '../../store/infraTypes'

export interface RouteResult {
  exists: boolean
  path: string[]
  connectionIds: string[]
  totalLatencyMs: number
  totalPacketLoss: number
}

export interface ShortestPathTree {
  startNodeId: string
  getPathTo(endNodeId: string): RouteResult
}

import type { AdjacencyMap } from './types'

/**
 * findShortestPathsFromSource
 * Executes a single-source Dijkstra pathfinding run to compute the shortest
 * path tree from startNodeId to ALL other reachable nodes.
 */
export function findShortestPathsFromSource(
  startNodeId: string,
  nodes: InfraNode[],
  _connections: Connection[],
  adjMap: AdjacencyMap
): ShortestPathTree {
  const activeNodes = new Set<string>()

  nodes.forEach(n => {
    if (n.systemState === 'off' || n.isBlackholed) return
    activeNodes.add(n.id)
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

    if (u === null || minDist === Infinity) {
      break
    }

    visited.add(u)

    const neighbors = adjMap.nodeToConnections.get(u) || []
    for (const connId of neighbors) {
      const conn = adjMap.connectionMap.get(connId)
      if (!conn || conn.status === 'blocked' || conn.isBlackholed) continue
      
      const v = conn.startNodeId === u ? conn.endNodeId : conn.startNodeId
      if (!activeNodes.has(v)) continue
      if (visited.has(v)) continue
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

  return {
    startNodeId,
    getPathTo(endNodeId: string): RouteResult {
      const startNode = nodes.find(n => n.id === startNodeId)
      const endNode = nodes.find(n => n.id === endNodeId)
      if (startNode?.systemState === 'off' || endNode?.systemState === 'off') {
        return {
          exists: false,
          path: [],
          connectionIds: [],
          totalLatencyMs: 999.0,
          totalPacketLoss: 1.0
        }
      }

      if (startNodeId === endNodeId) {
        return {
          exists: true,
          path: [startNodeId],
          connectionIds: [],
          totalLatencyMs: 0.0,
          totalPacketLoss: 0.0
        }
      }

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
        const conn = adjMap.connectionMap.get(connId)
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
  }
}

/**
 * NetworkRouteCache
 * High-performance static routing cache. Automatically invalidates pre-computed path trees
 * when the graph topology structure changes.
 */
export class NetworkRouteCache {
  private static fingerprint = -1
  private static cache = new Map<string, ShortestPathTree>()

  public static getShortestPathTree(
    startNodeId: string,
    nodes: InfraNode[],
    connections: Connection[],
    adjMap: AdjacencyMap,
    topologyHash: number
  ): ShortestPathTree {
    if (topologyHash !== this.fingerprint) {
      this.fingerprint = topologyHash
      this.cache.clear()
    }

    let tree = this.cache.get(startNodeId)
    if (!tree) {
      tree = findShortestPathsFromSource(startNodeId, nodes, connections, adjMap)
      this.cache.set(startNodeId, tree)
    }

    return tree
  }

  public static clear() {
    this.fingerprint = -1
    this.cache.clear()
  }

  public static getCacheSize(): number {
    return this.cache.size
  }

  public static getFingerprint(): number {
    return this.fingerprint
  }
}

/**
 * findShortestPath
 * High-performance, self-contained Dijkstra pathfinder tailored for real-time 
 * network physics simulations. Resolves routes optimally through SSSP caching.
 */
export function findShortestPath(
  startNodeId: string,
  endNodeId: string,
  nodes: InfraNode[],
  connections: Connection[],
  adjMap: AdjacencyMap,
  topologyHash: number
): RouteResult {
  const tree = NetworkRouteCache.getShortestPathTree(startNodeId, nodes, connections, adjMap, topologyHash)
  return tree.getPathTo(endNodeId)
}
