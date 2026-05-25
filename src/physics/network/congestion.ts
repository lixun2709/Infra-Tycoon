import type { Connection, InfraNode } from '../../store/infraTypes'
import type { AdjacencyMap } from './types'
import type { NetworkDemand } from './types'
import { INCIDENT_PROFILES } from './types'
import { NetworkRouteCache } from './routing'

export interface CongestionResult {
  updatedConnections: Connection[]
  newlyInfectedNodeIds: string[]
}

/**
 * resolveCongestion
 * Aggregates network throughput via dynamic Dijkstra routing paths.
 * Also evaluates lateral lateral infection propagation and applies multi-queue QoS packet delays/loss.
 */
export function resolveCongestion(
  nodes: InfraNode[],
  connections: Connection[],
  demands: NetworkDemand[],
  adjMap: AdjacencyMap,
  topologyHash: number,
  dt = 1.0
): CongestionResult {
  const demandMap = new Map(demands.map(d => [d.nodeId, d]))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // 1. Compile Graph Adjacency & Compute Flow Aggregation via Shortest Paths
  const accumulatedThroughput = new Map<string, number>()
  connections.forEach(c => accumulatedThroughput.set(c.id, 0.0))

  const routedDemands = new Map<string, number>()

  nodes.forEach(sourceNode => {
    // Only route demands for running, active device nodes (racks, cooling, and network switches do not originate outbound demands)
    if (sourceNode.type === 'rack' || sourceNode.type === 'cooling' || sourceNode.type === 'network') return
    if (sourceNode.systemState === 'off') return
    if (sourceNode.isBlackholed) return

    const demand = demandMap.get(sourceNode.id)?.demandGbps ?? 0
    if (demand <= 0) return

    // Find the nearest appropriate target node of standard categories
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
      routedDemands.set(sourceNode.id, demand)
    }
  })

  // 2. Incident Lateral Propagation Model
  const newlyInfectedNodeIds: string[] = []
  
  // Create a copy of the infected states locally for lateral propagation processing
  const localInfected = new Set(nodes.filter(n => n.isInfected).map(n => n.id))

  nodes.forEach(u => {
    // If node is infected and powered, it can spread malware to adjacent hops
    if (localInfected.has(u.id) && u.systemState !== 'off') {
      const adjacentConnIds = adjMap.nodeToConnections.get(u.id) || []
      
      adjacentConnIds.forEach(connId => {
        const conn = adjMap.connectionMap.get(connId)
        if (!conn || conn.status === 'blocked' || conn.isBlackholed) return

        const vId = conn.startNodeId === u.id ? conn.endNodeId : conn.startNodeId
        const v = nodeMap.get(vId)

        if (v && v.type !== 'rack' && v.type !== 'cooling' && v.systemState !== 'off') {
          // If adjacent node is healthy, evaluate propagation probability
          if (!localInfected.has(v.id) && !newlyInfectedNodeIds.includes(v.id)) {
            const chance = INCIDENT_PROFILES.ransomware!.propagationChance * dt
            if (Math.random() < chance) {
              newlyInfectedNodeIds.push(v.id)
            }
          }
        }
      })
    }
  })

  // 3. Resolve congestion metrics on links based on accumulated Dijkstra flows
  const updatedConnections = connections.map(conn => {
    const startNode = nodeMap.get(conn.startNodeId)
    const endNode = nodeMap.get(conn.endNodeId)

    // 1. Administrative Blackholing / Null Routing check
    if (conn.status === 'blocked' || conn.isBlackholed || startNode?.isBlackholed || endNode?.isBlackholed) {
      return {
        ...conn,
        throughputGbps: 0,
        latencyMs: 999.0,
        packetLoss: 1.0,
        status: 'blocked' as const,
        isBlackholed: true,
        controlQueueDelayMs: 0.0,
        bulkQueueDelayMs: 0.0,
        packetsDropped: (conn.packetsDropped ?? 0) + (conn.status !== 'blocked' ? 100 : 0)
      }
    }

    if (!startNode || !endNode) return conn

    // Retrieve accumulated dynamic throughput
    const throughput = accumulatedThroughput.get(conn.id) || 0.0

    const capBandwidth = conn.bandwidthGbps || 10.0
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
    const newStatus = newThroughput >= capBandwidth * 0.95 ? 'degraded' as const : 'active' as const

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

  return { updatedConnections, newlyInfectedNodeIds }
}
