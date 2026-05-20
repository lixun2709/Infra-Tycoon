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
  adjMap: AdjacencyMap,
  dt = 1.0
): CongestionResult {
  const demandMap = new Map(demands.map(d => [d.nodeId, d]))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Approximation Model for fast scalable throughput aggregation:
  const updatedConnections = connections.map(conn => {
    const startNode = nodeMap.get(conn.startNodeId)
    const endNode = nodeMap.get(conn.endNodeId)

    // 1. Administrative Blackholing / Null Routing check
    if (conn.status === 'blocked' || startNode?.isBlackholed || endNode?.isBlackholed) {
      return {
        ...conn,
        throughputGbps: 0,
        latencyMs: 999.0,
        packetLoss: 1.0,
        status: 'blocked' as const,
        isBlackholed: true,
        controlQueueDelayMs: 0,
        bulkQueueDelayMs: 0,
        packetsDropped: (conn.packetsDropped ?? 0) + (conn.status !== 'blocked' ? 100 : 0)
      }
    }

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

    // 2. V2 QoS Priority Queuing Pipelines
    let controlQueueDelay = 0.0
    let appQueueDelay = 0.0
    let bulkQueueDelay = 0.0

    let appPacketLoss = 0.0
    let bulkPacketLoss = 0.0

    if (ratio > 0.8) {
      const overloadFactor = (ratio - 0.8) / 0.7
      
      // Control Queue: prioritized, very low queue latency ceiling, 0% drop rate
      controlQueueDelay = Math.pow(overloadFactor, 3) * 5.0 // Cap at +5ms
      
      // Application Queue: moderate priority, caps at +20ms, up to 15% drops
      appQueueDelay = Math.pow(overloadFactor, 3) * 20.0
      appPacketLoss = Math.min(0.15, Math.pow(overloadFactor, 2) * 0.15)
      
      // Bulk Data Queue: lowest priority, caps at +50ms, up to 80% drops
      bulkQueueDelay = Math.pow(overloadFactor, 3) * 50.0
      bulkPacketLoss = Math.min(0.80, Math.pow(overloadFactor, 2) * 0.80)
    }

    // Weighted traffic aggregation (10% Control, 50% Application, 40% Bulk)
    const weightedDelay = (0.1 * controlQueueDelay) + (0.5 * appQueueDelay) + (0.4 * bulkQueueDelay)
    const overallLoss = (0.1 * 0.0) + (0.5 * appPacketLoss) + (0.4 * bulkPacketLoss)

    let activeIncidentMultiplier = 1.0
    const startIncident = demandMap.get(conn.startNodeId)?.activeIncident
    const endIncident = demandMap.get(conn.endNodeId)?.activeIncident
    const activeIncidentKey = startIncident || endIncident
    if (activeIncidentKey && INCIDENT_PROFILES[activeIncidentKey]) {
      activeIncidentMultiplier = INCIDENT_PROFILES[activeIncidentKey]!.latencyMultiplier
    }

    const calculatedLatency = Math.min(120, (1 + weightedDelay) * activeIncidentMultiplier)
    const newThroughput = Math.min(capBandwidth, throughput)
    const newStatus = newThroughput >= capBandwidth ? 'degraded' as const : 'active' as const

    // 3. Frame-rate independent time-scaled Link Synchronization
    const newSync = Math.min(100, (conn.syncProgress ?? 0) + (newThroughput / capBandwidth) * 15.0 * dt)

    // Calculate approximate packet drops per tick (Gbps * loss * multiplier)
    const droppedPacketsCount = overallLoss > 0.0 ? Math.floor(newThroughput * overallLoss * 15 * dt) : 0

    return {
      ...conn,
      throughputGbps: Number(newThroughput.toFixed(2)),
      latencyMs: Number(calculatedLatency.toFixed(1)),
      status: newStatus,
      syncProgress: Number(newSync.toFixed(1)),
      packetLoss: Number(overallLoss.toFixed(4)),
      controlQueueDelayMs: Number(controlQueueDelay.toFixed(1)),
      bulkQueueDelayMs: Number(bulkQueueDelay.toFixed(1)),
      packetsDropped: (conn.packetsDropped ?? 0) + droppedPacketsCount
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
