import { System } from '../System'
import type { TransformComponent, PowerComponent, ConnectionComponent } from '../types'
import type { InfraNode, Connection } from '../../../store/infraTypes'
import { simulateNetwork } from '../../../physics/network/simulation'

/**
 * PacketSystem
 * ECS System governing physical packet routing, cabling topology compilation,
 * and link congestion buffering delay propagation.
 */
export class PacketSystem extends System {
  public static networkLoad = 0.0

  public update(_dt: number) {
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
        currentPowerKW: power?.load ?? 0
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
        packetLoss: conn.packetLoss ?? 0.0
      })
    })

    if (connections.length === 0) {
      return
    }

    // 3. Invoke deterministic aggregate-flow physical calculation
    const { connections: updatedConnections } = simulateNetwork(nodes, connections, PacketSystem.networkLoad)

    // 4. Propagate updated properties back to ECS components
    updatedConnections.forEach(conn => {
      const existing = connectionMap.get(conn.id)
      if (existing) {
        existing.throughputGbps = conn.throughputGbps
        existing.latencyMs = conn.latencyMs
        existing.status = conn.status
        existing.syncProgress = conn.syncProgress
        existing.packetLoss = conn.packetLoss
      }
    })
  }
}
