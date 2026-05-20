import { System } from '../System'
import type { TransformComponent, PowerComponent, ConnectionComponent } from '../types'
import type { InfraNode, Connection } from '../../../store/infraTypes'
import { simulateNetwork } from '../../../physics/network/simulation'
import { ObservabilitySystem } from './ObservabilitySystem'

/**
 * PacketSystem
 * ECS System governing physical packet routing, cabling topology compilation,
 * and link congestion buffering delay propagation.
 */
export class PacketSystem extends System {
  public static networkLoad = 0.0

  public update(dt: number) {
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')

    // 1. Reconstruct lightweight, simulation-only node states from ECS
    const nodes: InfraNode[] = []
    transformMap.forEach((transform, id) => {
      const power = powerMap.get(id)
      nodes.push({
        id,
        type: transform.type as unknown as InfraNode['type'],
        siteId: transform.siteId,
        parentRackId: transform.parentRackId,
        slotIndex: transform.slotIndex,
        systemState: power?.isPowered ? 'running' : 'off',
        isInfected: transform.isInfected ?? false,
        healthStatus: (transform.healthStatus as unknown as InfraNode['healthStatus']) ?? 'healthy',
        degradation: transform.degradation ?? 0,
        wattage: power?.wattage ?? 0,
        currentPowerKW: power?.load ?? 0,
        // V2 parameters
        isBlackholed: transform.isBlackholed ?? false,
        rateLimitGbps: transform.rateLimitGbps
      } as InfraNode)
    })

    // 2. Reconstruct lightweight, simulation-only connection states from ECS
    const connections: Connection[] = []
    connectionMap.forEach((conn, id) => {
      connections.push({
        id,
        startNodeId: conn.startNodeId,
        startPortId: conn.startPortId,
        endNodeId: conn.endNodeId,
        endPortId: conn.endPortId,
        bandwidthGbps: conn.bandwidthGbps,
        throughputGbps: conn.throughputGbps,
        latencyMs: conn.latencyMs,
        isBlockedByCompliance: conn.isBlockedByCompliance,
        status: conn.status,
        syncProgress: conn.syncProgress,
        type: conn.type as unknown as Connection['type'],
        packetLoss: conn.packetLoss ?? 0.0,
        // V2 additions
        controlQueueDelayMs: conn.controlQueueDelayMs,
        bulkQueueDelayMs: conn.bulkQueueDelayMs,
        packetsDropped: conn.packetsDropped,
        isBlackholed: conn.isBlackholed,
        rateLimitGbps: conn.rateLimitGbps
      })
    })

    if (connections.length === 0) {
      return
    }

    // 3. Invoke deterministic aggregate-flow physical calculation forwarding dt
    const { connections: updatedConnections, newlyInfectedNodeIds } = simulateNetwork(
      nodes,
      connections,
      PacketSystem.networkLoad,
      dt
    )

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

        // Push alert into ObservabilitySystem to notify the UI
        ObservabilitySystem.pushFiredAlert({
          severity: 'critical',
          message: `CRITICAL: Ransomware lateral propagation! Node [${transform.name || nodeId}] has been infected over network link.`,
          nodeId
        })
      }
    })

    // 5. Propagate updated properties back to ECS components
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
      }
    })
  }
}
