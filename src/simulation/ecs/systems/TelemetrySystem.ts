import { System } from '../System'
import type { 
  TelemetryComponent, 
  PowerComponent, 
  ThermalComponent, 
  StorageComponent,
  TransformComponent,
  ConnectionComponent
} from '../types'

export interface SimStats {
  averageUptimeRatio: number
  overheatedNodeCount: number
  congestedLinkCount: number
  totalPowerDrawKW: number
  totalStorageUsedTB: number
  totalStorageCapacityTB: number
}

/**
 * TelemetrySystem
 * ECS System governing operational statistics collection, per-entity lifecycle history,
 * and high-performance aggregate datacenter simulation profiling.
 */
export class TelemetrySystem extends System {
  public static simStats: SimStats = {
    averageUptimeRatio: 1.0,
    overheatedNodeCount: 0,
    congestedLinkCount: 0,
    totalPowerDrawKW: 0.0,
    totalStorageUsedTB: 0.0,
    totalStorageCapacityTB: 0.0
  }

  public update(_dt: number) {
    const telemetryMap = this.world.getComponentMap<TelemetryComponent>('telemetry')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const storageMap = this.world.getComponentMap<StorageComponent>('storage')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')

    const entities = this.world.getEntitiesWith(['telemetry', 'transform'])

    let activeUptimesSum = 0
    let totalEntitiesCount = 0
    let overheatedCount = 0
    let totalPower = 0.0
    let totalStorageUsed = 0.0
    let totalStorageCapacity = 0.0

    // 1. Process Per-Entity Telemetry Components
    entities.forEach(id => {
      const telemetry = telemetryMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)
      const storage = storageMap.get(id)
      const transform = transformMap.get(id)!

      // Update counters
      telemetry.totalTicks++

      // Powered status
      const isPowered = power?.isPowered ?? false
      if (isPowered) {
        telemetry.uptimeTicks++
      }

      // Thermal safeguards
      if (thermal && thermal.isThrottled) {
        telemetry.thermalThrottlingTicks++
      }
      if (thermal && thermal.temperature >= 70.0) {
        overheatedCount++
      }

      // Storage IOPS loading
      if (storage && storage.ioPSUsed >= storage.ioPSLimit && storage.ioPSLimit > 0) {
        telemetry.storageIopsThrottlingTicks++
      }

      // Network congestion
      if (transform && transform.degradation && transform.degradation > 50) {
        telemetry.networkCongestionTicks++
      }

      // Add to running metrics
      totalEntitiesCount++
      activeUptimesSum += telemetry.totalTicks > 0 ? (telemetry.uptimeTicks / telemetry.totalTicks) : 1.0

      if (power && isPowered) {
        totalPower += power.load || 0.0
      }

      if (storage) {
        totalStorageUsed += storage.usedStorageTB || 0.0
        totalStorageCapacity += storage.totalStorageTB || 0.0
      }
    })

    // 2. Process Connections Telemetry
    let congestedLinks = 0
    connectionMap.forEach(conn => {
      if (conn.status === 'degraded') {
        congestedLinks++
      }
    })

    // 3. Compile Aggregated Datacenter Simulation Statistics
    TelemetrySystem.simStats = {
      averageUptimeRatio: totalEntitiesCount > 0 ? activeUptimesSum / totalEntitiesCount : 1.0,
      overheatedNodeCount: overheatedCount,
      congestedLinkCount: congestedLinks,
      totalPowerDrawKW: totalPower,
      totalStorageUsedTB: totalStorageUsed,
      totalStorageCapacityTB: totalStorageCapacity
    }
  }
}
