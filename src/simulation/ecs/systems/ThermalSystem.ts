import { System } from '../System'
import type { ThermalComponent, PowerComponent, TransformComponent } from '../types'
import { ThermalGlobals, LoadStats } from './thermal/ThermalGlobals'
import { CRACManager } from './thermal/CRACManager'
import { RoomAmbientEngine } from './thermal/RoomAmbientEngine'
import { RackMicroclimate } from './thermal/RackMicroclimate'
import { DeviceThermalCalculator } from './thermal/DeviceThermalCalculator'

/**
 * ThermalSystem
 * ECS implementation of thermodynamic simulation.
 * Handles conduction, convection, zone-localized site cooling, dynamic server fans, rack micro-climates, and safety shutdowns.
 */
export class ThermalSystem extends System {
  // Re-export static variables for external tests and backwards compatibility
  public static get siteAmbientTemps() { return ThermalGlobals.siteAmbientTemps }
  public static get siteAmbientHumidity() { return ThermalGlobals.siteAmbientHumidity }
  public static get BASE_AMBIENT_TEMP() { return ThermalGlobals.BASE_AMBIENT_TEMP }
  public static get CONDUCTION_COEFFICIENT() { return ThermalGlobals.CONDUCTION_COEFFICIENT }

  private accumulatedTime = 0.0 // V2 multiplayer-safe deterministic elapsed time (seconds)
  private adjacentRackPairsBySite = new Map<string, [string, string][]>()
  private lastRackEntitiesHashBySite = new Map<string, number>()

  // Zero-Allocation Object Pools for ECS Optimization
  private racksPool: string[] = []
  private coolingUnitsPool: string[] = []
  private chassisNodesPool: string[] = []
  
  private cracUnitsBySitePool = new Map<string, string[]>()
  private siteStandbyMapPool = new Map<string, Set<string>>()
  private siteLoadsPool = new Map<string, LoadStats>()
  private rackLoadsPool = new Map<string, LoadStats>()
  private racksBySitePool = new Map<string, string[]>()
  private rackChildrenMapPool = new Map<string, string[]>()
  private activeHeatBySitePool = new Map<string, number>()
  private deltaTempPool = new Map<string, number>()

  public clear() {
    // Allows resetting the state entirely when World is torn down in tests
    ThermalGlobals.siteAmbientTemps.clear()
    ThermalGlobals.siteAmbientHumidity.clear()
    this.cracUnitsBySitePool.clear()
    this.siteStandbyMapPool.clear()
    this.siteLoadsPool.clear()
    this.rackLoadsPool.clear()
    this.racksBySitePool.clear()
    this.rackChildrenMapPool.clear()
    this.activeHeatBySitePool.clear()
    this.deltaTempPool.clear()
    this.accumulatedTime = 0.0
  }

  public update(dt: number) {
    const startTime = performance.now()

    // 1. Advance deterministic time tracking
    this.accumulatedTime += dt

    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    const entities = this.world.getEntitiesWith(['thermal', 'transform'])

    // Clear pooled arrays without GC allocations
    this.racksPool.length = 0
    this.coolingUnitsPool.length = 0
    this.chassisNodesPool.length = 0
    this.activeHeatBySitePool.clear()

    for (const arr of this.cracUnitsBySitePool.values()) arr.length = 0
    for (const set of this.siteStandbyMapPool.values()) set.clear()
    for (const stats of this.siteLoadsPool.values()) stats.reset()
    for (const stats of this.rackLoadsPool.values()) stats.reset()
    for (const arr of this.racksBySitePool.values()) arr.length = 0
    for (const arr of this.rackChildrenMapPool.values()) arr.length = 0
    this.deltaTempPool.clear()

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        this.racksPool.push(id)
      } else if (transform.type === 'cooling') {
        this.coolingUnitsPool.push(id)
      } else {
        this.chassisNodesPool.push(id)
      }
    })

    // Pre-calculate server heat loads by site for Lead-Lag scheduler and N+1 calculations
    this.chassisNodesPool.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const siteId = transform.siteId || 'default-site'
      const isRunning = power?.isPowered ?? false

      let serverHeatBTU = 0.5 // Minimal ambient heat in idle state
      if (isRunning && power) {
        const efficiency = power.efficiency ?? 0.8
        serverHeatBTU = Math.max(10.0, power.wattage * 3.412 * (1.1 - efficiency))
      }
      this.activeHeatBySitePool.set(siteId, (this.activeHeatBySitePool.get(siteId) ?? 0) + serverHeatBTU)
    })

    // Group CRAC units by site room
    this.coolingUnitsPool.forEach(id => {
      const transform = transformMap.get(id)!
      const siteId = transform.siteId || 'default-site'
      let list = this.cracUnitsBySitePool.get(siteId)
      if (!list) {
        list = []
        this.cracUnitsBySitePool.set(siteId, list)
      }
      list.push(id)
    })

    // Initialize loads for sites and racks
    this.racksPool.forEach(id => {
      let stats = this.rackLoadsPool.get(id)
      if (!stats) {
        stats = new LoadStats()
        this.rackLoadsPool.set(id, stats)
      } else {
        stats.reset()
      }
    })

    // Initialize site loads
    this.cracUnitsBySitePool.forEach((_, siteId) => {
      let stats = this.siteLoadsPool.get(siteId)
      if (!stats) {
        stats = new LoadStats()
        this.siteLoadsPool.set(siteId, stats)
      } else {
        stats.reset()
      }
    })

    // Delegate to Modular Functional Architectures
    
    // 2. CRAC Manager (Lead-Lag Redundancy and Cooling Extractor)
    CRACManager.processCRACUnits(
      this.coolingUnitsPool,
      this.cracUnitsBySitePool,
      this.siteStandbyMapPool,
      this.activeHeatBySitePool,
      this.siteLoadsPool,
      this.rackLoadsPool,
      thermalMap,
      powerMap,
      transformMap,
      this.accumulatedTime,
      this.world.eventBus
    )

    // 3. Device Thermal Calculator (CPU Throttling, Silicon Heat, Fans)
    DeviceThermalCalculator.processServerThermodynamics(
      this.chassisNodesPool,
      this.racksPool,
      this.rackChildrenMapPool,
      this.siteLoadsPool,
      this.rackLoadsPool,
      thermalMap,
      powerMap,
      transformMap,
      dt,
      this.accumulatedTime,
      this.world.eventBus
    )

    // 4. Rack Microclimate (Convection, Conduction, Recirculation)
    RackMicroclimate.processRackMicroclimates(
      this.racksPool,
      this.racksBySitePool,
      this.adjacentRackPairsBySite,
      this.lastRackEntitiesHashBySite,
      this.deltaTempPool,
      this.rackLoadsPool,
      thermalMap,
      transformMap,
      this.world,
      dt,
      this.accumulatedTime
    )

    // 5. Room Ambient Engine (Global Dispersion, Heat Sinks, Humidity)
    RoomAmbientEngine.processRoomThermodynamics(
      this.siteLoadsPool,
      this.cracUnitsBySitePool,
      powerMap,
      thermalMap,
      transformMap,
      dt,
      this.world.eventBus
    )

    // CRAC unit reported temperature relaxation convergence (needs to happen after Room Ambient Engine calculates temps)
    this.coolingUnitsPool.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalGlobals.siteAmbientTemps.get(siteId) ?? ThermalGlobals.BASE_AMBIENT_TEMP

      const isStandby = this.siteStandbyMapPool.get(siteId)?.has(id) ?? false
      const isRunning = (power?.isPowered ?? false) && !isStandby
      
      let efficiency = 1.0
      if (isRunning) {
        if (roomAmbientTemp > 60.0) {
          efficiency = 0.0
        } else if (roomAmbientTemp > 40.0) {
          efficiency = Math.max(0.2, 1.0 - 0.04 * (roomAmbientTemp - 40.0))
        }
      } else {
        efficiency = 0.0
      }

      // Calculate chilled water flow required to neutralize this BTU (approx 0.005 LPM per BTU/hr)
      const degradationFactor = Math.max(0.0, Math.min(1.0, 1.0 - (transform.degradation ?? 0.0) / 100.0))
      const effectiveCoolingBTU = Math.abs(thermal.btuOutput) * efficiency * degradationFactor
      
      if (effectiveCoolingBTU > 0) {
        thermal.waterFlowLPM = effectiveCoolingBTU * 0.005
      } else {
        thermal.waterFlowLPM = 0
      }

      // CRAC unit reported temperature relaxation convergence
      const currentCracTemp = thermal.temperature ?? roomAmbientTemp
      const cracTarget = roomAmbientTemp - (isRunning ? 10.0 * efficiency : 0.0)
      const cracAlpha = 1.0 - Math.exp(-dt / 60.0) // 1 minute time constant
      thermal.temperature = Math.max(18.0, currentCracTemp + (cracTarget - currentCracTemp) * cracAlpha)
      thermal.accumulatedSimTime = this.accumulatedTime
      thermal.lastUpdate = Math.floor(this.accumulatedTime * 1000)
    })

    const tEnd = performance.now()
    if (Math.random() < 0.1) {
      this.world.eventBus.publish('telemetry:system', {
        subsystem: 'thermal',
        executionTimeMs: Number((tEnd - startTime).toFixed(2))
      })
    }
  }
}
