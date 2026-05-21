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

/**
 * computeTopologyFingerprint
 * Creates a unique string signature representing the current graph structure,
 * node state, and administrative overrides (blackholing / connection status).
 */
export function computeTopologyFingerprint(nodes: InfraNode[], connections: Connection[]): string {
  const nodeParts = nodes
    .map(n => `${n.id}:${n.systemState === 'off' ? '0' : '1'}:${n.isBlackholed ? '1' : '0'}`)
    .sort()
    .join(',')

  const connParts = connections
    .map(c => `${c.id}:${c.status === 'blocked' ? '1' : '0'}:${c.isBlackholed ? '1' : '0'}`)
    .sort()
    .join(',')

  return `${nodeParts}|${connParts}`
}

/**
 * findShortestPathsFromSource
 * Executes a single-source Dijkstra pathfinding run to compute the shortest
 * path tree from startNodeId to ALL other reachable nodes.
 */
export function findShortestPathsFromSource(
  startNodeId: string,
  nodes: InfraNode[],
  connections: Connection[]
): ShortestPathTree {
  const adj = new Map<string, Array<{ node: string; conn: Connection }>>()
  const activeNodes = new Set<string>()

  nodes.forEach(n => {
    if (n.systemState === 'off') return
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

    if (u === null || minDist === Infinity) {
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
  }
}

/**
 * NetworkRouteCache
 * High-performance static routing cache. Automatically invalidates pre-computed path trees
 * when the graph topology structure changes.
 */
export class NetworkRouteCache {
  private static fingerprint = ''
  private static cache = new Map<string, ShortestPathTree>()

  public static getShortestPathTree(
    startNodeId: string,
    nodes: InfraNode[],
    connections: Connection[]
  ): ShortestPathTree {
    const currentFingerprint = computeTopologyFingerprint(nodes, connections)

    if (currentFingerprint !== this.fingerprint) {
      this.fingerprint = currentFingerprint
      this.cache.clear()
    }

    let tree = this.cache.get(startNodeId)
    if (!tree) {
      tree = findShortestPathsFromSource(startNodeId, nodes, connections)
      this.cache.set(startNodeId, tree)
    }

    return tree
  }

  public static clear() {
    this.fingerprint = ''
    this.cache.clear()
  }

  public static getCacheSize(): number {
    return this.cache.size
  }

  public static getFingerprint(): string {
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
  connections: Connection[]
): RouteResult {
  const tree = NetworkRouteCache.getShortestPathTree(startNodeId, nodes, connections)
  return tree.getPathTo(endNodeId)
}
