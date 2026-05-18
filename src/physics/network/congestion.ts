import type { Connection, InfraNode } from '../../store/infraTypes'
import type { AdjacencyMap } from './types'
import type { NetworkDemand } from './types'
import { INCIDENT_PROFILES } from './types'

export interface CongestionResult {
  updatedConnections: Connection[]
}

/**
 * resolveCongestion
 * Aggregates throughput levels dynamically, applying an exponential queue latency penalty
 * and connection degradation tags when bandwidth limits are saturated.
 */
export function resolveCongestion(
  nodes: InfraNode[],
  connections: Connection[],
  demands: NetworkDemand[],
  adjMap: AdjacencyMap
): CongestionResult {
  const demandMap = new Map(demands.map(d => [d.nodeId, d]))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Approximation Model for fast scalable throughput aggregation:
  const updatedConnections = connections.map(conn => {
    if (conn.status === 'blocked') {
      return { ...conn, throughputGbps: 0, latencyMs: 999 }
    }

    const startNode = nodeMap.get(conn.startNodeId)
    const endNode = nodeMap.get(conn.endNodeId)
    if (!startNode || !endNode) return conn

    // Throughput calculation
    let throughput = 0
    const startDemand = demandMap.get(conn.startNodeId)?.demandGbps || 0
    const endDemand = demandMap.get(conn.endNodeId)?.demandGbps || 0

    const isStartServer = startNode.type === 'compute' || startNode.type === 'storage' || startNode.type === 'backup' || startNode.type === 'security' || startNode.type === 'identity' || startNode.type === 'load_balancer'
    const isEndServer = endNode.type === 'compute' || endNode.type === 'storage' || endNode.type === 'backup' || startNode.type === 'security' || startNode.type === 'identity' || startNode.type === 'load_balancer'

    if (isStartServer && !isEndServer) {
      // Server-to-Switch connection
      throughput = startDemand
    } else if (isEndServer && !isStartServer) {
      // Switch-to-Server connection
      throughput = endDemand
    } else if (!isStartServer && !isEndServer) {
      // Switch-to-Switch Trunk line: aggregate downstream server traffic recursively
      const startTrunkLoad = aggregateSubtreeDemand(conn.startNodeId, conn.id, demandMap, adjMap, nodeMap, new Set())
      const endTrunkLoad = aggregateSubtreeDemand(conn.endNodeId, conn.id, demandMap, adjMap, nodeMap, new Set())
      throughput = Math.min(startTrunkLoad, endTrunkLoad) * 0.5
    } else {
      // Direct server-to-server connection
      throughput = Math.max(startDemand, endDemand)
    }

    const capBandwidth = conn.bandwidthGbps || 10
    const ratio = Math.min(1.5, throughput / capBandwidth)

    // Exponential queuing latency penalty
    let latencyPenalty = 0
    if (ratio > 0.8) {
      latencyPenalty = Math.pow((ratio - 0.8) / 0.7, 3) * 30 // queue buffering delay up to +30ms
    }

    let activeIncidentMultiplier = 1.0
    const startIncident = demandMap.get(conn.startNodeId)?.activeIncident
    const endIncident = demandMap.get(conn.endNodeId)?.activeIncident
    const activeIncidentKey = startIncident || endIncident
    if (activeIncidentKey && INCIDENT_PROFILES[activeIncidentKey]) {
      activeIncidentMultiplier = INCIDENT_PROFILES[activeIncidentKey]!.latencyMultiplier
    }

    const calculatedLatency = Math.min(100, (1 + latencyPenalty) * activeIncidentMultiplier)
    const newThroughput = Math.min(capBandwidth, throughput)
    const newStatus = newThroughput >= capBandwidth ? 'degraded' as const : 'active' as const

    const newSync = Math.min(100, (conn.syncProgress ?? 0) + (newThroughput / capBandwidth) * 15)

    return {
      ...conn,
      throughputGbps: Number(newThroughput.toFixed(2)),
      latencyMs: Number(calculatedLatency.toFixed(1)),
      status: newStatus,
      syncProgress: Number(newSync.toFixed(1))
    }
  })

  return { updatedConnections }
}

function aggregateSubtreeDemand(
  currentNodeId: string,
  incomingConnId: string,
  demandMap: Map<string, NetworkDemand>,
  adjMap: AdjacencyMap,
  nodeMap: Map<string, InfraNode>,
  visited: Set<string>
): number {
  if (visited.has(currentNodeId)) return 0
  visited.add(currentNodeId)

  let sum = 0
  const currentNode = nodeMap.get(currentNodeId)
  const isServer = currentNode && (
    currentNode.type === 'compute' || 
    currentNode.type === 'storage' || 
    currentNode.type === 'backup' ||
    currentNode.type === 'security' ||
    currentNode.type === 'identity' ||
    currentNode.type === 'load_balancer'
  )
  if (isServer) {
    sum += demandMap.get(currentNodeId)?.demandGbps || 0
  }

  const adjacentConns = adjMap.nodeToConnections.get(currentNodeId) || []
  for (const connId of adjacentConns) {
    if (connId === incomingConnId) continue
    const conn = adjMap.connectionMap.get(connId)
    if (!conn) continue
    const nextNodeId = conn.startNodeId === currentNodeId ? conn.endNodeId : conn.startNodeId
    sum += aggregateSubtreeDemand(nextNodeId, connId, demandMap, adjMap, nodeMap, visited)
  }

  return sum
}
