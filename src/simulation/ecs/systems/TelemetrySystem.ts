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
import { CircularBuffer } from '../../../utils/CircularBuffer'

export interface SimStats {
  averageUptimeRatio: number
  overheatedNodeCount: number
  congestedLinkCount: number
  totalPowerDrawKW: number
  totalStorageUsedTB: number
  totalStorageCapacityTB: number
  pue: number
  wue: number
}

export interface AnomalyThresholds {
  tempSpikeDelta: number
  powerSpikeMinLoad: number
  powerSpikePercent: number
  sitePowerSaturationPercent: number
}

export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  tempSpikeDelta: 5.0,
  powerSpikeMinLoad: 0.15,
  powerSpikePercent: 50.0,
  sitePowerSaturationPercent: 0.90
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
    tempHistory: CircularBuffer,
    thresholds: AnomalyThresholds,
    publishAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId: string) => void
  ): void {
    if (tempHistory.length > 0) {
      const lastTemp = tempHistory.last()
      if (lastTemp !== undefined) {
        const delta = currentTemp - lastTemp
        if (delta > thresholds.tempSpikeDelta) {
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
    powerHistory: CircularBuffer,
    thresholds: AnomalyThresholds,
    onSpike: () => void
  ): void {
    if (powerHistory.length > 0) {
      const lastLoad = powerHistory.last()
      if (lastLoad !== undefined) {
        const delta = Math.abs(currentLoad - lastLoad)
        if (delta > thresholds.powerSpikeMinLoad && lastLoad > 0) {
          const percentChange = (delta / lastLoad) * 100
          if (percentChange > thresholds.powerSpikePercent) {
            onSpike()
          }
        }
      }
    }
  }

  /**
   * Detects site-wide power saturation warnings.
   */
  public static detectSitePowerSaturation(
    siteId: string,
    powerSum: number,
    maxKW: number,
    thresholds: AnomalyThresholds,
    publishAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId: string) => void
  ): void {
    if (maxKW > 0 && powerSum > maxKW * thresholds.sitePowerSaturationPercent) {
      publishAlert(
        'critical',
        `Site ${siteId} power draw saturation threat: ${powerSum.toFixed(1)}kW / ${maxKW.toFixed(1)}kW (${(thresholds.sitePowerSaturationPercent * 100).toFixed(0)}% exceeded)`,
        siteId
      )
    }
  }
}

/**
 * TelemetrySystem
 * ECS System governing operational statistics collection, per-entity lifecycle history,
 * and high-performance aggregate datacenter simulation profiling using Zero-Allocation Circular Buffers.
 */
export class TelemetrySystem extends System {
  public simStats: SimStats = {
    averageUptimeRatio: 1.0,
    overheatedNodeCount: 0,
    congestedLinkCount: 0,
    totalPowerDrawKW: 0.0,
    totalStorageUsedTB: 0.0,
    totalStorageCapacityTB: 0.0,
    pue: 1.0,
    wue: 0.0
  }

  // Site-wide rolling metrics history maps
  public sitePowerHistory = new Map<string, CircularBuffer>()
  public siteTempHistory = new Map<string, CircularBuffer>()
  public siteHumidityHistory = new Map<string, CircularBuffer>()

  public thresholds: AnomalyThresholds = { ...DEFAULT_THRESHOLDS }

  // Subsystem Performance Profiling Instrumentation
  public lastExecutionTimeMs = 0.0
  private executionTickCounter = 0
  
  // Zero-allocation persistent Maps for per-tick site aggregations
  private siteTempsSum = new Map<string, number>()
  private siteTempsCount = new Map<string, number>()
  private sitePowerSum = new Map<string, number>()

  public static readonly MAX_HISTORY_LENGTH = 30

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
    let itPower = 0.0
    let totalWaterLPM = 0.0
    let totalStorageUsed = 0.0
    let totalStorageCapacity = 0.0

    // Clear persistent maps for the new tick without allocating new objects
    this.siteTempsSum.clear()
    this.siteTempsCount.clear()
    this.sitePowerSum.clear()

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

      // Initialize histories if undefined using pre-allocated Circular Buffers
      if (!telemetry.powerHistory) telemetry.powerHistory = new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH)
      if (!telemetry.tempHistory) telemetry.tempHistory = new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH)
      if (!telemetry.iopsHistory) telemetry.iopsHistory = new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH)

      const currentTemp = thermal?.temperature ?? 20.0
      const currentLoad = isPowered ? (power?.load ?? 0.0) : 0.0
      const currentIops = storage?.ioPSUsed ?? 0

      // Node Anomaly Detection: Temperature rising too quickly (>5°C)
      TelemetryAnomalyDetector.detectTemperatureSpike(
        id,
        transform.name || '',
        currentTemp,
        telemetry.tempHistory,
        this.thresholds,
        publishAlert
      )

      // Node Anomaly Detection: Sudden power load fluctuations
      TelemetryAnomalyDetector.detectPowerSpike(
        currentLoad,
        telemetry.powerHistory,
        this.thresholds,
        () => {
          telemetry.powerSpikesCount++
        }
      )

      // Append node metrics to ring buffer history using Zero-GC optimizer
      telemetry.powerHistory.push(currentLoad)
      telemetry.tempHistory.push(currentTemp)
      telemetry.iopsHistory.push(currentIops)

      // Gather temp statistics per site
      const siteId = transform.siteId
      if (siteId) {
        this.siteTempsSum.set(siteId, (this.siteTempsSum.get(siteId) ?? 0) + currentTemp)
        this.siteTempsCount.set(siteId, (this.siteTempsCount.get(siteId) ?? 0) + 1)
        this.sitePowerSum.set(siteId, (this.sitePowerSum.get(siteId) ?? 0) + currentLoad)
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
        if (transform.type !== 'cooling') {
          itPower += power.load || 0.0
        }
      }
      
      if (thermal && thermal.waterFlowLPM) {
        totalWaterLPM += thermal.waterFlowLPM
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
    this.sitePowerSum.forEach((powerSum, siteId) => {
      // Initialize rolling maps
      if (!this.sitePowerHistory.has(siteId)) this.sitePowerHistory.set(siteId, new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH))
      if (!this.siteTempHistory.has(siteId)) this.siteTempHistory.set(siteId, new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH))
      if (!this.siteHumidityHistory.has(siteId)) this.siteHumidityHistory.set(siteId, new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH))

      const powerHistory = this.sitePowerHistory.get(siteId)!
      const tempHistory = this.siteTempHistory.get(siteId)!
      const humidityHistory = this.siteHumidityHistory.get(siteId)!

      // Average temperature computation
      const sum = this.siteTempsSum.get(siteId) ?? 0
      const count = this.siteTempsCount.get(siteId) ?? 0
      const avgTemp = count > 0 ? sum / count : 22.0

      // Humidity from ThermalSystem
      const currentHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0

      // Append rolling variables using Zero-GC slider
      powerHistory.push(powerSum)
      tempHistory.push(avgTemp)
      humidityHistory.push(currentHumidity)

      // Anomaly trigger: Site breaker saturation
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
        this.thresholds,
        publishAlert
      )
    })

    // 4. Compile Aggregated Datacenter Simulation Statistics
    this.simStats = {
      averageUptimeRatio: totalEntitiesCount > 0 ? activeUptimesSum / totalEntitiesCount : 1.0,
      overheatedNodeCount: overheatedCount,
      congestedLinkCount: congestedLinks,
      totalPowerDrawKW: totalPower,
      totalStorageUsedTB: totalStorageUsed,
      totalStorageCapacityTB: totalStorageCapacity,
      pue: itPower > 0 ? (totalPower / itPower) : 1.0,
      wue: itPower > 0 ? (totalWaterLPM / itPower) : 0.0
    }

    const tEnd = performance.now()
    this.lastExecutionTimeMs = tEnd - startTime
    
    // Performance Instrumentation hook using deterministic execution tick count rather than Math.random()
    this.executionTickCounter++
    if (this.executionTickCounter % 10 === 0) {
      this.world.eventBus.publish('telemetry:system', {
        subsystem: 'telemetry',
        nodesProcessed: totalEntitiesCount,
        executionTimeMs: Number(this.lastExecutionTimeMs.toFixed(2))
      })
    }
  }
}
