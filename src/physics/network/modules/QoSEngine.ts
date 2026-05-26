import type { Connection, InfraNode } from '../../../store/infraTypes'
import type { NetworkDemand } from '../types'
import { INCIDENT_PROFILES } from '../types'

export class QoSEngine {
  /**
   * Resolves congestion metrics on links based on accumulated Dijkstra flows, applies priority queuing, and drops packets.
   */
  public static resolveMetrics(
    connections: Connection[],
    accumulatedThroughput: Map<string, number>,
    nodes: InfraNode[],
    demands: NetworkDemand[],
    dt: number
  ): Connection[] {
    const demandMap = new Map(demands.map(d => [d.nodeId, d]))
    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    return connections.map(conn => {
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
        // Enforce strict bounding to prevent floating-point drift
        const overloadFactor = Math.min(1.0, Math.max(0.0, (ratio - 0.8) / 0.7))
        const overSq = overloadFactor * overloadFactor
        const overCube = overSq * overloadFactor
        
        // Control Queue: prioritized, very low queue latency ceiling, 0% drop rate
        controlQueueDelay = Number((overCube * 5.0).toFixed(2))
        
        // Application Queue: moderate priority, caps at +20ms, up to 15% drops
        appQueueDelay = Number((overCube * 20.0).toFixed(2))
        appPacketLoss = Number(Math.min(0.15, overSq * 0.15).toFixed(4))
        
        // Bulk Data Queue: lowest priority, caps at +50ms, up to 80% drops
        bulkQueueDelay = Number((overCube * 50.0).toFixed(2))
        bulkPacketLoss = Number(Math.min(0.80, overSq * 0.80).toFixed(4))
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
  }
}
