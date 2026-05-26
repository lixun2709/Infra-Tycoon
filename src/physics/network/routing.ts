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
  getClosestTarget(targetIds: string[]): RouteResult
}

import type { AdjacencyMap } from './types'

/**
 * MinPriorityQueue
 * High-performance binary heap tailored for O((V + E) log V) Dijkstra SSSP.
 */
class MinPriorityQueue {
  private heap: { id: string; dist: number }[] = []

  public enqueue(id: string, dist: number) {
    this.heap.push({ id, dist })
    this.bubbleUp(this.heap.length - 1)
  }

  public dequeue(): { id: string; dist: number } | undefined {
    if (this.heap.length === 0) return undefined
    const min = this.heap[0]
    const end = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = end
      this.sinkDown(0)
    }
    return min
  }

  public isEmpty() {
    return this.heap.length === 0
  }

  private bubbleUp(index: number) {
    const element = this.heap[index]!
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      const parent = this.heap[parentIndex]!
      if (element.dist >= parent.dist) break
      this.heap[index] = parent
      this.heap[parentIndex] = element
      index = parentIndex
    }
  }

  private sinkDown(index: number) {
    const length = this.heap.length
    const element = this.heap[index]!
    while (true) {
      const leftChildIdx = 2 * index + 1
      const rightChildIdx = 2 * index + 2
      let swapIdx: number | null = null
      let leftChildDist = Infinity
      
      if (leftChildIdx < length) {
        const leftChild = this.heap[leftChildIdx]!
        leftChildDist = leftChild.dist
        if (leftChildDist < element.dist) swapIdx = leftChildIdx
      }
      
      if (rightChildIdx < length) {
        const rightChild = this.heap[rightChildIdx]!
        const rightChildDist = rightChild.dist
        if (
          (swapIdx === null && rightChildDist < element.dist) ||
          (swapIdx !== null && rightChildDist < leftChildDist)
        ) {
          swapIdx = rightChildIdx
        }
      }
      
      if (swapIdx === null) break
      this.heap[index] = this.heap[swapIdx]!
      this.heap[swapIdx] = element
      index = swapIdx
    }
  }
}

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
  const pq = new MinPriorityQueue()

  dist.set(startNodeId, 0)
  pq.enqueue(startNodeId, 0)

  while (!pq.isEmpty()) {
    const min = pq.dequeue()!
    const u = min.id
    
    if (min.dist > (dist.get(u) ?? Infinity)) continue

    const neighbors = adjMap.nodeToConnections.get(u) || []
    for (const connId of neighbors) {
      const conn = adjMap.connectionMap.get(connId)
      if (!conn || conn.status === 'blocked' || conn.isBlackholed) continue
      
      const v = conn.startNodeId === u ? conn.endNodeId : conn.startNodeId
      if (!activeNodes.has(v)) continue
      const latency = conn.latencyMs ?? 1.0
      const loss = conn.packetLoss ?? 0.0
      const throughput = conn.throughputGbps ?? 0.0
      const capacity = conn.bandwidthGbps || 10.0
      const utilization = Math.min(1.0, throughput / capacity)

      // Traffic-engineered weight formula
      const weight = latency * (1.0 + loss * 5.0) + (utilization * 2.0)
      const alt = min.dist + weight

      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt)
        prev.set(v, { nodeId: u, connId: conn.id })
        pq.enqueue(v, alt)
      }
    }
  }

  const resultTree: ShortestPathTree = {
    startNodeId,
    getClosestTarget(targetIds: string[]): RouteResult {
      let bestTargetId: string | null = null
      let minTargetCost = Infinity
      for (let i = 0; i < targetIds.length; i++) {
        const tid = targetIds[i]!
        const d = dist.get(tid) ?? Infinity
        if (d < minTargetCost) {
          minTargetCost = d
          bestTargetId = tid
        }
      }
      if (!bestTargetId) {
        return {
          exists: false,
          path: [],
          connectionIds: [],
          totalLatencyMs: 999.0,
          totalPacketLoss: 1.0
        }
      }
      return this.getPathTo(bestTargetId)
    },
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

  return resultTree
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
