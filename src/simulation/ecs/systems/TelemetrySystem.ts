import { System } from '../System'
import type { 
  TelemetryComponent, 
  PowerComponent, 
  ThermalComponent, 
  StorageComponent,
  TransformComponent,
  ConnectionComponent,
  RackComponent
} from '../types'
import { ThermalSystem } from './ThermalSystem'

export interface SimStats {
  averageUptimeRatio: number
  overheatedNodeCount: number
  congestedLinkCount: number
  totalPowerDrawKW: number
  totalStorageUsedTB: number
  totalStorageCapacityTB: number
}

/**
 * TelemetryAnomalyDetector
 * Decouples operational threshold monitoring and anomaly detection from the main update loop.
 */
export class TelemetryAnomalyDetector {
  /**
   * Evaluates silicon temperature updates and fires an alert if a temperature spike exceeds the rate threshold.
   */
  public static detectTemperatureSpike(
    nodeId: string,
    nodeName: string,
    currentTemp: number,
    tempHistory: number[],
    publishAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId: string) => void
  ): void {
    if (tempHistory.length > 0) {
      const lastTemp = tempHistory[tempHistory.length - 1]
      if (lastTemp !== undefined) {
        const delta = currentTemp - lastTemp
        if (delta > 5.0) {
          publishAlert(
            'warning',
            `Rapid silicon temperature spike on node ${nodeName || nodeId}: +${delta.toFixed(1)}°C`,
            nodeId
          )
        }
      }
    }
  }

  /**
   * Detects sudden severe power load changes.
   */
  public static detectPowerSpike(
    currentLoad: number,
    powerHistory: number[],
    onSpike: () => void
  ): void {
    if (powerHistory.length > 0) {
      const lastLoad = powerHistory[powerHistory.length - 1]
      if (lastLoad !== undefined) {
        const delta = Math.abs(currentLoad - lastLoad)
        // Significant spike defined as a load variation greater than 0.15 kW and over 50% variance
        if (delta > 0.15 && lastLoad > 0) {
          const percentChange = (delta / lastLoad) * 100
          if (percentChange > 50.0) {
            onSpike()
          }
        }
      }
    }
  }

  /**
   * Detects site-wide power saturation warnings (90% capacity threat).
   */
  public static detectSitePowerSaturation(
    siteId: string,
    powerSum: number,
    maxKW: number,
    publishAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId: string) => void
  ): void {
    if (maxKW > 0 && powerSum > maxKW * 0.90) {
      publishAlert(
        'critical',
        `Site ${siteId} power draw saturation threat: ${powerSum.toFixed(1)}kW / ${maxKW.toFixed(1)}kW (90% exceeded)`,
        siteId
      )
    }
  }
}

/**
 * Sliding window buffer update utility.
 * In-place operation optimizes memory performance to prevent micro-stutters under high scale.
 */
export function fastSlideBuffer(arr: number[], newValue: number, maxLength: number): void {
  arr.push(newValue)
  if (arr.length > maxLength) {
    arr.shift()
  }
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

  // Site-wide rolling metrics history maps
  public static sitePowerHistory = new Map<string, number[]>()
  public static siteTempHistory = new Map<string, number[]>()
  public static siteHumidityHistory = new Map<string, number[]>()

  // Subsystem Performance Profiling Instrumentation
  public static lastExecutionTimeMs = 0.0
  
  private static readonly MAX_HISTORY_LENGTH = 30

  public update(_dt: number) {
    const startTime = performance.now()

    const telemetryMap = this.world.getComponentMap<TelemetryComponent>('telemetry')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const storageMap = this.world.getComponentMap<StorageComponent>('storage')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')
    const rackMap = this.world.getComponentMap<RackComponent>('rack')

    const entities = this.world.getEntitiesWith(['telemetry', 'transform'])

    let activeUptimesSum = 0
    let totalEntitiesCount = 0
    let overheatedCount = 0
    let totalPower = 0.0
    let totalStorageUsed = 0.0
    let totalStorageCapacity = 0.0

    // Temporary groupings per site to compute site averages
    const siteTempsMap = new Map<string, number[]>()
    const sitePowerMap = new Map<string, number>()

    const publishAlert = (severity: 'info' | 'warning' | 'critical', message: string, nodeId: string) => {
      this.world.eventBus.publish('system:alert', { severity, message, nodeId })
    }

    // 1. Process Per-Entity Telemetry Components
    entities.forEach(id => {
      const telemetry = telemetryMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)
      const storage = storageMap.get(id)
      const transform = transformMap.get(id)!

      // Update counters deterministically based on simulation ticks
      telemetry.totalTicks++

      // Powered status
      const isPowered = power?.isPowered ?? false
      if (isPowered) {
        telemetry.uptimeTicks++
      }

      // Initialize histories if undefined
      if (!telemetry.powerHistory) telemetry.powerHistory = []
      if (!telemetry.tempHistory) telemetry.tempHistory = []
      if (!telemetry.iopsHistory) telemetry.iopsHistory = []

      const currentTemp = thermal?.temperature ?? 20.0
      const currentLoad = isPowered ? (power?.load ?? 0.0) : 0.0
      const currentIops = storage?.ioPSUsed ?? 0

      // Node Anomaly Detection: Temperature rising too quickly (>5°C)
      TelemetryAnomalyDetector.detectTemperatureSpike(
        id,
        transform.name || '',
        currentTemp,
        telemetry.tempHistory,
        publishAlert
      )

      // Node Anomaly Detection: Sudden power load fluctuations
      TelemetryAnomalyDetector.detectPowerSpike(
        currentLoad,
        telemetry.powerHistory,
        () => {
          telemetry.powerSpikesCount++
        }
      )

      // Append node metrics to ring buffer history using Zero-GC optimizer
      fastSlideBuffer(telemetry.powerHistory, currentLoad, TelemetrySystem.MAX_HISTORY_LENGTH)
      fastSlideBuffer(telemetry.tempHistory, currentTemp, TelemetrySystem.MAX_HISTORY_LENGTH)
      fastSlideBuffer(telemetry.iopsHistory, currentIops, TelemetrySystem.MAX_HISTORY_LENGTH)

      // Gather temp statistics per site
      const siteId = transform.siteId
      if (siteId) {
        if (!siteTempsMap.has(siteId)) siteTempsMap.set(siteId, [])
        siteTempsMap.get(siteId)!.push(currentTemp)

        sitePowerMap.set(siteId, (sitePowerMap.get(siteId) ?? 0.0) + currentLoad)
      }

      // Thermal safeguards
      if (thermal && thermal.isThrottled) {
        telemetry.thermalThrottlingTicks++
      }
      if (thermal && thermal.temperature >= 70.0) {
        overheatedCount++
      }

      // Storage IOPS loading
      if (storage && storage.ioPSLimit > 0 && storage.ioPSUsed >= storage.ioPSLimit) {
        telemetry.storageIopsThrottlingTicks++
      }

      // Network congestion
      if (transform && transform.degradation && transform.degradation > 50) {
        telemetry.networkCongestionTicks++
      }

      // Audit Violations: warnings tracked when server operates in dangerous environments
      const hasThermalWarning = thermal && thermal.temperature >= 70.0
      const hasNetworkDegradationWarning = transform && transform.degradation && transform.degradation > 80
      if (hasThermalWarning || hasNetworkDegradationWarning) {
        telemetry.auditViolationsCount++
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

    // 2. Process Connections Telemetry & Anomaly Alerts
    let congestedLinks = 0
    connectionMap.forEach(conn => {
      if (conn.status === 'degraded') {
        congestedLinks++
      }

      // Anomaly trigger: Severe packet drop on link
      if (conn.packetsDropped && conn.packetsDropped > 500) {
        this.world.eventBus.publish('system:alert', {
          severity: 'warning',
          message: `Severe packet drop threshold exceeded on connection link ${conn.entityId}: ${conn.packetsDropped} drops`
        })
      }
    })

    // 3. Compile Site-Wide rolling historical aggregates
    sitePowerMap.forEach((powerSum, siteId) => {
      // Initialize rolling maps
      if (!TelemetrySystem.sitePowerHistory.has(siteId)) TelemetrySystem.sitePowerHistory.set(siteId, [])
      if (!TelemetrySystem.siteTempHistory.has(siteId)) TelemetrySystem.siteTempHistory.set(siteId, [])
      if (!TelemetrySystem.siteHumidityHistory.has(siteId)) TelemetrySystem.siteHumidityHistory.set(siteId, [])

      const powerHistory = TelemetrySystem.sitePowerHistory.get(siteId)!
      const tempHistory = TelemetrySystem.siteTempHistory.get(siteId)!
      const humidityHistory = TelemetrySystem.siteHumidityHistory.get(siteId)!

      // Average temperature computation
      const tempsList = siteTempsMap.get(siteId) ?? []
      const avgTemp = tempsList.length > 0 ? tempsList.reduce((a, b) => a + b, 0) / tempsList.length : 22.0

      // Humidity from ThermalSystem
      const currentHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0

      // Append rolling variables using Zero-GC slider
      fastSlideBuffer(powerHistory, powerSum, TelemetrySystem.MAX_HISTORY_LENGTH)
      fastSlideBuffer(tempHistory, avgTemp, TelemetrySystem.MAX_HISTORY_LENGTH)
      fastSlideBuffer(humidityHistory, currentHumidity, TelemetrySystem.MAX_HISTORY_LENGTH)

      // Anomaly trigger: Site breaker saturation (90% breaker limit warning)
      let maxKW = 0.0
      rackMap.forEach(rack => {
        const transComp = transformMap.get(rack.entityId)
        if (transComp && transComp.siteId === siteId) {
          maxKW += rack.maxPowerKW
        }
      })

      TelemetryAnomalyDetector.detectSitePowerSaturation(
        siteId,
        powerSum,
        maxKW,
        publishAlert
      )
    })

    // 4. Compile Aggregated Datacenter Simulation Statistics
    TelemetrySystem.simStats = {
      averageUptimeRatio: totalEntitiesCount > 0 ? activeUptimesSum / totalEntitiesCount : 1.0,
      overheatedNodeCount: overheatedCount,
      congestedLinkCount: congestedLinks,
      totalPowerDrawKW: totalPower,
      totalStorageUsedTB: totalStorageUsed,
      totalStorageCapacityTB: totalStorageCapacity
    }

    TelemetrySystem.lastExecutionTimeMs = performance.now() - startTime
  }
}
