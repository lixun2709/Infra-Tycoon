import { System } from '../System'
import type { TransformComponent, PowerComponent, ConnectionComponent } from '../types'
import type { InfraNode, Connection } from '../../../store/infraTypes'
import { simulateNetwork } from '../../../physics/network/simulation'

function fastStringHash(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * PacketSystem
 * ECS System governing physical packet routing, cabling topology compilation,
 * and link congestion buffering delay propagation.
 * 
 * Architecture: Enterprise-grade Zero-Allocation Memory Pooling
 */
export class PacketSystem extends System {
  public static networkLoad = 0.0 // internal dynamic networking rate metrics

  // Object Pools to prevent GC allocation spikes every simulation tick
  private nodePool: InfraNode[] = []
  private connectionPool: Connection[] = []

  public update(dt: number): void {
    const tStart = performance.now()

    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')

    // 1. Reconstruct lightweight, simulation-only node states from ECS using Object Pools
    let nodeIndex = 0
    let topologyHash = 0
    transformMap.forEach((transform, id) => {
      const power = powerMap.get(id)
      
      if (nodeIndex >= this.nodePool.length) {
        this.nodePool.push({} as InfraNode)
      }
      
      const n = this.nodePool[nodeIndex]!
      n.id = id
      n.type = transform.type as unknown as InfraNode['type']
      n.siteId = transform.siteId
      n.parentRackId = transform.parentRackId
      n.slotIndex = transform.slotIndex
      n.systemState = power?.isPowered ? 'running' : 'off'
      n.isInfected = transform.isInfected ?? false
      n.healthStatus = (transform.healthStatus as unknown as InfraNode['healthStatus']) ?? 'healthy'
      n.degradation = transform.degradation ?? 0
      n.wattage = power?.wattage ?? 0
      n.currentPowerKW = power?.load ?? 0
      n.isBlackholed = transform.isBlackholed ?? false
      n.rateLimitGbps = transform.rateLimitGbps
      
      const nHash = fastStringHash(id) ^ (n.systemState === 'off' ? 0 : 1) ^ (n.isBlackholed ? 2 : 0)
      topologyHash = (topologyHash + nHash) >>> 0

      nodeIndex++
    })
    // Trim array length safely
    if (this.nodePool.length > nodeIndex) {
      this.nodePool.length = nodeIndex
    }

    // 2. Reconstruct lightweight, simulation-only connection states from ECS using Object Pools
    let connIndex = 0
    connectionMap.forEach((conn, id) => {
      if (connIndex >= this.connectionPool.length) {
        this.connectionPool.push({} as Connection)
      }

      const c = this.connectionPool[connIndex]!
      c.id = id
      c.startNodeId = conn.startNodeId
      c.startPortId = conn.startPortId
      c.endNodeId = conn.endNodeId
      c.endPortId = conn.endPortId
      c.bandwidthGbps = conn.bandwidthGbps
      c.throughputGbps = conn.throughputGbps
      c.latencyMs = conn.latencyMs
      c.isBlockedByCompliance = conn.isBlockedByCompliance
      c.status = conn.status
      c.syncProgress = conn.syncProgress
      c.type = conn.type as unknown as Connection['type']
      c.packetLoss = conn.packetLoss ?? 0.0
      c.controlQueueDelayMs = conn.controlQueueDelayMs
      c.bulkQueueDelayMs = conn.bulkQueueDelayMs
      c.packetsDropped = conn.packetsDropped
      c.isBlackholed = conn.isBlackholed
      c.rateLimitGbps = conn.rateLimitGbps

      const cHash = fastStringHash(id) ^ (c.status === 'blocked' ? 1 : 0) ^ (c.isBlackholed ? 2 : 0)
      topologyHash = (topologyHash + cHash) >>> 0

      connIndex++
    })
    if (this.connectionPool.length > connIndex) {
      this.connectionPool.length = connIndex
    }

    const tExtraction = performance.now()

    if (this.connectionPool.length === 0) {
      return
    }

    // 3. Invoke deterministic aggregate-flow physical calculation forwarding dt
    const { connections: updatedConnections, newlyInfectedNodeIds } = simulateNetwork(
      this.nodePool,
      this.connectionPool,
      PacketSystem.networkLoad,
      topologyHash,
      dt
    )

    const tSimulation = performance.now()

    // 4. Handle newly infected nodes via lateral spread
    newlyInfectedNodeIds.forEach(nodeId => {
      const transform = transformMap.get(nodeId)
      if (transform) {
        transform.isInfected = true

        // Notify the ECS Event Bus
        this.world.eventBus.publish('system:alert', {
          entityId: nodeId,
          message: `CRITICAL: Ransomware lateral propagation! Node [${transform.name || nodeId}] has been infected over network link.`,
          severity: 'critical'
        })
      }
    })

    // 5. Propagate updated properties back to ECS components
    let totalDrops = 0
    updatedConnections.forEach(conn => {
      const existing = connectionMap.get(conn.id)
      if (existing) {
        existing.throughputGbps = conn.throughputGbps
        existing.latencyMs = conn.latencyMs
        existing.status = conn.status
        existing.syncProgress = conn.syncProgress
        existing.packetLoss = conn.packetLoss
        // Propagate QoS telemetry back to connection component
        existing.controlQueueDelayMs = conn.controlQueueDelayMs
        existing.bulkQueueDelayMs = conn.bulkQueueDelayMs
        existing.packetsDropped = conn.packetsDropped
        existing.isBlackholed = conn.isBlackholed
        existing.rateLimitGbps = conn.rateLimitGbps
        
        totalDrops += (existing.packetsDropped ?? 0)
      }
    })

    const tEnd = performance.now()

    // 6. Publish Performance & Telemetry Instrumentation Metrics
    if (Math.random() < 0.1) { // Throttle telemetry to roughly 1Hz if running at 10 ticks/sec
      this.world.eventBus.publish('telemetry:network', {
        nodes: nodeIndex,
        connections: connIndex,
        totalPacketDrops: totalDrops,
        load: PacketSystem.networkLoad,
        perf: {
          extractionMs: Number((tExtraction - tStart).toFixed(2)),
          simulationMs: Number((tSimulation - tExtraction).toFixed(2)),
          propagationMs: Number((tEnd - tSimulation).toFixed(2)),
          totalMs: Number((tEnd - tStart).toFixed(2))
        }
      })
    }
  }
}
