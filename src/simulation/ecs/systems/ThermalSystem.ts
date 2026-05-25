import { System } from '../System'
import type { ThermalComponent, PowerComponent, TransformComponent, RackComponent } from '../types'
import { HARDWARE_CATALOG, type HardwareCatalogSpec } from '../../../physics/hardwareLibrary'

class LoadStats {
  serverHeatBTU = 0
  coolingBTU = 0
  reset() {
    this.serverHeatBTU = 0
    this.coolingBTU = 0
  }
}

/**
 * ThermalSystem
 * ECS implementation of thermodynamic simulation.
 * Handles conduction, convection, zone-localized site cooling, dynamic server fans, rack micro-climates, and safety shutdowns.
 */
export class ThermalSystem extends System {
  public static siteAmbientTemps = new Map<string, number>()
  public static siteAmbientHumidity = new Map<string, number>() // V2 room relative humidity %

  private accumulatedTime = 0.0 // V2 multiplayer-safe deterministic elapsed time (seconds)
  private adjacentRackPairsBySite = new Map<string, [string, string][]>()
  private lastRackEntitiesHashBySite = new Map<string, string>()

  private static CONDUCTION_COEFFICIENT = 0.05 / 9.0
  private static BASE_AMBIENT_TEMP = 22.0
  private static DEFAULT_CRITICAL = 80.0 // Silicon shutdown limit
  private static DEFAULT_THROTTLE = 70.0 // Performance throttling limit
  private static ROOM_TIME_CONSTANT = 1800.0 // 30 minutes room time constant (massive thermal inertia)
  private static RACK_TIME_CONSTANT = 300.0 // 5 minutes rack time constant
  private static ROOM_DISPERSION_COEFF = 6000.0 // BTU/hr per C (calibrated industrial dispersion)
  private static RACK_CONV_COEFF = 300.0 // BTU/hr per C (realistic local hot aisle buildup)
  private static RECIRCULATION_NONE = 0.50
  private static RECIRCULATION_HOT_AISLE = 0.15
  private static RECIRCULATION_COLD_AISLE = 0.05

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
    ThermalSystem.siteAmbientTemps.clear()
    ThermalSystem.siteAmbientHumidity.clear()
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

    // V2 Lead-Lag Redundancy Scheduler
    // Cycle standby assignments every 60 simulated seconds for even degradation
    const currentCycle = Math.floor(this.accumulatedTime / 60.0)

    this.cracUnitsBySitePool.forEach((units, siteId) => {
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const roomHeatLoad = this.activeHeatBySitePool.get(siteId) ?? 0

      // Sort units deterministically by entityId for multiplayer stability
      const sortedUnits = [...units].sort()
      const totalCoolingCapacity = sortedUnits.reduce((sum, cracId) => {
        const thermal = thermalMap.get(cracId)
        return sum + (thermal ? Math.abs(thermal.btuOutput) : 0)
      }, 0)

      let standbySet = this.siteStandbyMapPool.get(siteId)
      if (!standbySet) {
        standbySet = new Set<string>()
        this.siteStandbyMapPool.set(siteId, standbySet)
      }

      // Standby criteria: We have N+1 redundant capacity, room is not overheating (>26°C), and we have multiple CRACs
      if (sortedUnits.length >= 2 && roomAmbientTemp < 26.0 && totalCoolingCapacity > roomHeatLoad * 1.5) {
        // Calculate how many units we can put in standby. 
        // We must keep enough active units to cover 1.2x room heat load.
        let activeCapacity = 0
        const requiredCapacity = roomHeatLoad * 1.2

        for (let i = 0; i < sortedUnits.length; i++) {
          const rotationIndex = (i + currentCycle) % sortedUnits.length
          const cracId = sortedUnits[rotationIndex]!
          const thermal = thermalMap.get(cracId)
          const capacity = thermal ? Math.abs(thermal.btuOutput) : 0

          if (activeCapacity < requiredCapacity || activeCapacity === 0) {
            // Keep active
            activeCapacity += capacity
          } else {
            // Put in standby
            standbySet.add(cracId)
          }
        }
      }
    })

    // 2. Initialize loads for sites and racks
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

    // 3. Process Cooling units - calculate dynamic efficiency, throttling, and safety shutdowns
    this.coolingUnitsPool.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP

      const isStandby = this.siteStandbyMapPool.get(siteId)?.has(id) ?? false
      thermal.isStandby = isStandby

      const isRunning = (power?.isPowered ?? false) && !isStandby
      const coolingName = transform.name || `CRAC-${id.slice(0, 4)}`

      // Dynamic standby power draw: standby units run at 10% idle draw
      if (isStandby && power) {
        power.load = 0.1
      }

      // Environmental limits checking (maxOperatingTemp = 60C, throttleTemp = 50C)
      let efficiency = 1.0

      if (isRunning) {
        if (roomAmbientTemp > 60.0) {
          // Safety thermal shutdown
          if (power) {
            power.isPowered = false
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `CRITICAL: High-temperature thermal shutdown on cooling unit ${coolingName}. Room temperature reached ${roomAmbientTemp.toFixed(1)}°C!`,
              severity: 'critical'
            })
          }
          efficiency = 0.0
        } else {
          // Continuous smooth efficiency degradation above 40°C
          if (roomAmbientTemp > 40.0) {
            efficiency = Math.max(0.2, 1.0 - 0.04 * (roomAmbientTemp - 40.0))
          }
          
          // Throttling thresholds for telemetry/alerts
          if (roomAmbientTemp > 50.0) {
            if (!thermal.isThrottled) {
              thermal.isThrottled = true
              this.world.eventBus.publish('system:alert', {
                entityId: id,
                message: `WARNING: Cooling unit ${coolingName} is throttled due to high room temperature (${roomAmbientTemp.toFixed(1)}°C). Capacity cut smoothly.`,
                severity: 'warning'
              })
            }
          } else if (thermal.isThrottled && roomAmbientTemp < 45.0) {
            thermal.isThrottled = false
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `INFO: Cooling unit ${coolingName} thermal throttling cleared.`,
              severity: 'info'
            })
          }
        }
      } else {
        efficiency = 0.0
      }

      // Degradation scale factor (1.0 - degradationPercent / 100)
      const degradationFactor = Math.max(0.0, Math.min(1.0, 1.0 - (transform.degradation ?? 0.0) / 100.0))
      const effectiveCoolingBTU = Math.abs(thermal.btuOutput) * efficiency * degradationFactor

      if (isRunning && effectiveCoolingBTU > 0) {
        if (transform.parentRackId) {
          // In-Row CRAC cooling specific rack micro-climate
          const rackLoad = this.rackLoadsPool.get(transform.parentRackId)
          if (rackLoad) {
            // Apply aisle containment cooling efficiency factor (calibrated bounded engineering parameters)
            const parentRackThermal = thermalMap.get(transform.parentRackId)
            const containment = parentRackThermal?.containmentType ?? 'none'
            let containmentFactor = 0.80 // standard efficiency
            if (containment === 'cold_aisle') {
              containmentFactor = 0.95 // cold aisle focused
            } else if (containment === 'hot_aisle') {
              containmentFactor = 0.90 // hot aisle containment
            }
            rackLoad.coolingBTU += effectiveCoolingBTU * containmentFactor
          }
        }
        
        // Add to general site loads
        let siteLoad = this.siteLoadsPool.get(siteId)
        if (!siteLoad) {
          siteLoad = new LoadStats()
          this.siteLoadsPool.set(siteId, siteLoad)
        }
        siteLoad.coolingBTU += effectiveCoolingBTU
      }

      // CRAC unit reported temperature relaxation convergence
      const currentCracTemp = thermal.temperature ?? roomAmbientTemp
      const cracTarget = roomAmbientTemp - (isRunning ? 10.0 * efficiency : 0.0)
      const cracAlpha = 1.0 - Math.exp(-dt / 60.0) // 1 minute time constant
      thermal.temperature = Math.max(18.0, currentCracTemp + (cracTarget - currentCracTemp) * cracAlpha)
      thermal.accumulatedSimTime = this.accumulatedTime
      thermal.lastUpdate = Math.floor(this.accumulatedTime * 1000)
    })

    // 4. Process active server heat generation loads
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

      // Add to specific rack load if mounted in a rack
      if (transform.parentRackId) {
        const rackLoad = this.rackLoadsPool.get(transform.parentRackId)
        if (rackLoad) {
          rackLoad.serverHeatBTU += serverHeatBTU
        }
      }

      // Add to general site loads
      let siteLoad = this.siteLoadsPool.get(siteId)
      if (!siteLoad) {
        siteLoad = new LoadStats()
        this.siteLoadsPool.set(siteId, siteLoad)
      }
      siteLoad.serverHeatBTU += serverHeatBTU
    })

    // 5. Calculate Rack Micro-climate Thermal Zone states
    this.racksPool.forEach(rackId => {
      const rackThermal = thermalMap.get(rackId)!
      const rackTransform = transformMap.get(rackId)!
      const siteId = rackTransform.siteId || 'default-site'
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP

      const containment = rackThermal.containmentType ?? 'none'
      let recircFraction = ThermalSystem.RECIRCULATION_NONE
      if (containment === 'cold_aisle') {
        recircFraction = ThermalSystem.RECIRCULATION_COLD_AISLE
      } else if (containment === 'hot_aisle') {
        recircFraction = ThermalSystem.RECIRCULATION_HOT_AISLE
      }

      const load = this.rackLoadsPool.get(rackId) ?? { serverHeatBTU: 0, coolingBTU: 0 }

      // Containment Airflow Impedance: Bypass leaks through empty slots without blanking panels
      let emptySlotsWithoutPanels = 0
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)
      if (rackComp) {
        if (!rackComp.blankingPanels) {
          rackComp.blankingPanels = new Array(43).fill(true)
        }
        for (let u = 1; u <= 42; u++) {
          const isOccupied = rackComp.slotOccupancy[u] ?? false
          const hasPanel = rackComp.blankingPanels[u] ?? true
          if (!isOccupied && !hasPanel) {
            emptySlotsWithoutPanels++
          }
        }
      }
      const bypassAirflowFactor = Math.max(0.1, 1.0 - 0.05 * emptySlotsWithoutPanels)
      const adjustedCoolingBTU = load.coolingBTU * bypassAirflowFactor
      const netRackHeat = recircFraction * load.serverHeatBTU - adjustedCoolingBTU

      const currentRackTemp = rackThermal.temperature ?? roomAmbientTemp
      const rackTargetTemp = roomAmbientTemp + (netRackHeat / ThermalSystem.RACK_CONV_COEFF)
      const rackTargetClamped = Math.max(16.0, Math.min(65.0, rackTargetTemp))

      const rackAlpha = 1.0 - Math.exp(-dt / ThermalSystem.RACK_TIME_CONSTANT)
      const nextRackTemp = currentRackTemp + (rackTargetClamped - currentRackTemp) * rackAlpha

      rackThermal.temperature = nextRackTemp

      // Relative Humidity Calculations for Rack containment
      const roomHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0
      // Localized heating drops relative humidity within the rack containment
      const tempDiff = Math.max(0.0, nextRackTemp - roomAmbientTemp)
      const rackHumidity = Math.max(10.0, roomHumidity - tempDiff * 0.8)
      rackThermal.humidity = rackHumidity

      rackThermal.accumulatedSimTime = this.accumulatedTime
      rackThermal.lastUpdate = Math.floor(this.accumulatedTime * 1000)
    })

    // 5.5 Localized Hot Aisle lateral convection between adjacent racks
    this.racksPool.forEach(id => {
      const transform = transformMap.get(id)
      if (transform) {
        const sId = transform.siteId || 'default-site'
        let list = this.racksBySitePool.get(sId)
        if (!list) {
          list = []
          this.racksBySitePool.set(sId, list)
        }
        list.push(id)
      }
    })

    this.racksBySitePool.forEach((rackIds, siteId) => {
      rackIds.forEach(id => this.deltaTempPool.set(id, 0))

      const kConvection = 0.05 // lateral convection multiplier

      // Cache adjacent neighbors to avoid O(N^2) math operations and square roots every frame
      let siteHash = ""
      const sortedIds = [...rackIds].sort()
      for(let i=0; i<sortedIds.length; i++) {
         const pos = transformMap.get(sortedIds[i]!)?.position
         if (pos) {
             // Basic primitive string builder instead of excessive interpolation
             siteHash += sortedIds[i] + Math.round(pos.x*10) + Math.round(pos.z*10)
         }
      }
      
      const cachedHash = this.lastRackEntitiesHashBySite.get(siteId)

      if (siteHash !== cachedHash) {
        const pairs: [string, string][] = []
        for (let i = 0; i < rackIds.length; i++) {
          const rA = rackIds[i]!
          const transA = transformMap.get(rA)
          const posA = transA?.position
          if (!posA) continue

          for (let j = i + 1; j < rackIds.length; j++) {
            const rB = rackIds[j]!
            const transB = transformMap.get(rB)
            const posB = transB?.position
            if (!posB) continue

            const dx = posA.x - posB.x
            const dz = posA.z - posB.z
            const dist = Math.sqrt(dx * dx + dz * dz)

            // Racks are adjacent if distance <= 1.8 units in the horizontal plane
            if (dist > 0 && dist <= 1.8) {
              pairs.push([rA, rB])
            }
          }
        }
        this.adjacentRackPairsBySite.set(siteId, pairs)
        this.lastRackEntitiesHashBySite.set(siteId, siteHash)
      }

      const pairs = this.adjacentRackPairsBySite.get(siteId) || []
      pairs.forEach(([rA, rB]) => {
        const tA = thermalMap.get(rA)
        const tB = thermalMap.get(rB)
        if (tA && tB) {
          const flow = kConvection * (tB.temperature - tA.temperature) * dt
          this.deltaTempPool.set(rA, this.deltaTempPool.get(rA)! + flow)
          this.deltaTempPool.set(rB, this.deltaTempPool.get(rB)! - flow)
        }
      })

      rackIds.forEach(id => {
        const thermal = thermalMap.get(id)
        if (thermal) {
          const dT = this.deltaTempPool.get(id) ?? 0
          thermal.temperature = Math.max(16.0, Math.min(65.0, thermal.temperature + dT))
        }
      })
    })

    // 6. Compute new global Ambient Temperatures & Relative Humidity for each site room
    this.siteLoadsPool.forEach((load, siteId) => {
      const currentAmbient = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const currentHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0

      const netBTU = load.serverHeatBTU - load.coolingBTU
      const roomTargetTemp = ThermalSystem.BASE_AMBIENT_TEMP + (netBTU / ThermalSystem.ROOM_DISPERSION_COEFF)
      const roomTargetClamped = Math.max(15.0, Math.min(60.0, roomTargetTemp))

      const roomAlpha = 1.0 - Math.exp(-dt / ThermalSystem.ROOM_TIME_CONSTANT)
      const nextAmbient = currentAmbient + (roomTargetClamped - currentAmbient) * roomAlpha

      ThermalSystem.siteAmbientTemps.set(siteId, nextAmbient)

      // Dynamic Relative Humidity (RH) calculations
      // Count active running CRAC units in this site room
      const cracList = this.cracUnitsBySitePool.get(siteId) ?? []
      let activeCoolingEfficiencySum = 0
      cracList.forEach(cracId => {
        const p = powerMap.get(cracId)
        const t = thermalMap.get(cracId)
        if (p?.isPowered && !t?.isStandby) {
          const degFactor = Math.max(0.0, Math.min(1.0, 1.0 - (transformMap.get(cracId)?.degradation ?? 0.0) / 100.0))
          activeCoolingEfficiencySum += (t?.isThrottled ? 0.5 : 1.0) * degFactor
        }
      })

      let nextHumidity = currentHumidity
      if (activeCoolingEfficiencySum > 0) {
        // Active cooling units pull humidity towards optimized 45% standard
        nextHumidity -= (currentHumidity - 45.0) * 0.08 * activeCoolingEfficiencySum * dt
      } else {
        // Without active cooling, moisture slowly drifts back to outdoor ambient room humidity (85.0%)
        nextHumidity += (85.0 - currentHumidity) * 0.005 * dt
        // Heating up dry environment dynamically drops ambient Relative Humidity
        const ambientChange = nextAmbient - currentAmbient
        if (ambientChange > 0) {
          nextHumidity -= ambientChange * 0.4
        }
      }
      nextHumidity = Math.max(10.0, Math.min(95.0, nextHumidity))
      ThermalSystem.siteAmbientHumidity.set(siteId, nextHumidity)

      // Alert/Safeguards for room humidity levels
      if (nextHumidity > 80.0 && currentHumidity <= 80.0) {
        this.world.eventBus.publish('system:alert', {
          entityId: siteId,
          message: `CRITICAL: High relative humidity in room ${siteId} (${nextHumidity.toFixed(1)}% RH). Extreme risk of condensation and short-circuits!`,
          severity: 'critical'
        })
      } else if (nextHumidity < 20.0 && currentHumidity >= 20.0) {
        this.world.eventBus.publish('system:alert', {
          entityId: siteId,
          message: `WARNING: Low relative humidity in room ${siteId} (${nextHumidity.toFixed(1)}% RH). Electrostatic discharge (ESD) threat level high!`,
          severity: 'warning'
        })
      }
    })

    // 7. Process per-entity server thermodynamics (using rack micro-climate as its local ambient temperature!)
    this.chassisNodesPool.forEach(id => {
      const thermal = thermalMap.get(id)!
      const power = powerMap.get(id)
      const transform = transformMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const roomHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0

      // Local convective ambient: resolve to parent rack micro-climate if mounted
      let localAmbient = roomAmbientTemp
      let localHumidity = roomHumidity
      if (transform.parentRackId) {
        const parentRackThermal = thermalMap.get(transform.parentRackId)
        if (parentRackThermal) {
          localAmbient = parentRackThermal.temperature
          localHumidity = parentRackThermal.humidity ?? roomHumidity
        }
      }

      thermal.humidity = localHumidity

      const isRunning = power?.isPowered ?? false

      // Calculate dynamic active fan speed percent based on target temperature curve
      const currentTemp = thermal.temperature
      const targetFanSpeed = isRunning
        ? 20.0 + 80.0 * Math.min(1.0, Math.max(0.0, (currentTemp - 35.0) / 35.0))
        : 0.0
      
      const fanInertiaCoeff = 0.05 // Realistic gradual fan spin wind-up
      const alpha = Math.min(1.0, fanInertiaCoeff * dt)
      const newFanSpeed = thermal.fanSpeedPercent + (targetFanSpeed - thermal.fanSpeedPercent) * alpha
      thermal.fanSpeedPercent = Math.min(100.0, Math.max(isRunning ? 20.0 : 0.0, newFanSpeed))

      // Reconstruct dynamic workload utilization factor U directly from dynamic wattage
      let workload = 0.2
      if (isRunning && power) {
        const baseW = power.baseWattage ?? 300
        const maxW = baseW * 1.5 + 50
        workload = Math.max(0.0, Math.min(1.0, (power.wattage - baseW) / (maxW - baseW || 1)))
      }

      // Target Equilibrium Relaxation Model (High-Fidelity Server Thermal Mass & Inertia)
      const spec = (transform.catalogKey ? HARDWARE_CATALOG[transform.catalogKey as keyof typeof HARDWARE_CATALOG] : null) as HardwareCatalogSpec | null
      const efficiency = spec?.heatEfficiency ?? power?.efficiency ?? 0.8

      // Max expected temperature rise above ambient under 100% full workload
      const maxExpectedRise = 30.0 * (1.2 - efficiency)

      // Clamp localAmbient to prevent extreme mathematical bounds
      localAmbient = Math.max(10.0, Math.min(50.0, localAmbient))

      // Target equilibrium temperature convergence limit
      const fanEffectiveness = 0.5 + 1.0 * (thermal.fanSpeedPercent / 100.0)
      let targetTemp = localAmbient
      if (isRunning) {
        targetTemp += 8.0 + (workload * maxExpectedRise) / fanEffectiveness
      }

      // Safeguard: Clamp targetTemp to realistic environmental and hardware silicon range (15 C to 120 C)
      targetTemp = Math.max(15.0, Math.min(120.0, targetTemp))

      // Airflow response rate (Thermal inertia capacity). 
      // Dynamic server thermal time constant (takes 1-3 minutes to reach equilibrium when active, 5 minutes when off)
      let serverTimeConstant = isRunning
        ? (180.0 - 120.0 * (thermal.fanSpeedPercent / 100.0))
        : 300.0
      
      // Safeguard: Time constant must be positive and bounded to prevent division/exponential errors
      if (!Number.isFinite(serverTimeConstant) || Number.isNaN(serverTimeConstant) || serverTimeConstant < 1.0) {
        serverTimeConstant = 180.0
      }

      // Asymptotically converge to target temperature
      const tempAlpha = 1.0 - Math.exp(-dt / serverTimeConstant)
      let nextTemp = currentTemp + (targetTemp - currentTemp) * tempAlpha

      // Safeguard: Clamp nextTemp to prevent numerical blowups
      if (!Number.isFinite(nextTemp) || Number.isNaN(nextTemp)) {
        nextTemp = targetTemp
      }
      nextTemp = Math.max(15.0, Math.min(120.0, nextTemp))

      // Thermal Safety Thresholds & Alarm Event Publishing
      const throttle = spec?.throttleTemp ?? ThermalSystem.DEFAULT_THROTTLE
      const critical = spec?.maxOperatingTemp ?? ThermalSystem.DEFAULT_CRITICAL

      if (nextTemp > critical) {
        if (power && power.isPowered) {
          power.isPowered = false
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: Thermal shutdown on ${id}. Node reached ${nextTemp.toFixed(1)}°C (Max: ${critical}°C).`,
            severity: 'critical'
          })
        }
      } else if (nextTemp > throttle) {
        if (!thermal.isThrottled) {
          thermal.isThrottled = true
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `WARNING: Thermal throttling engaged on ${id} (${nextTemp.toFixed(1)}°C). CPU performance cut by 50%.`,
            severity: 'warning'
          })
        }
      } else if (thermal.isThrottled && nextTemp < throttle - 5.0) {
        thermal.isThrottled = false
        this.world.eventBus.publish('system:alert', {
          entityId: id,
          message: `INFO: Thermal throttling cleared on ${id}. Node operating temperature stabilized.`,
          severity: 'info'
        })
      }

      thermal.temperature = Math.max(18.0, nextTemp)
      thermal.accumulatedSimTime = this.accumulatedTime
      thermal.lastUpdate = Math.floor(this.accumulatedTime * 1000)
    })

    // 8. Conduction between adjacent entities in the same rack (optimized O(N) single-pass grouping)
    this.chassisNodesPool.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.parentRackId) {
        let list = this.rackChildrenMapPool.get(transform.parentRackId)
        if (!list) {
          list = []
          this.rackChildrenMapPool.set(transform.parentRackId, list)
        }
        list.push(id)
      }
    })

    this.racksPool.forEach(rackId => {
      const rackNodes = this.rackChildrenMapPool.get(rackId)
      if (!rackNodes || rackNodes.length < 2) return

      // Sort only local rack nodes by slotIndex
      rackNodes.sort((a, b) => (transformMap.get(a)?.slotIndex ?? 0) - (transformMap.get(b)?.slotIndex ?? 0))

      for (let i = 0; i < rackNodes.length - 1; i++) {
        const idA = rackNodes[i]
        const idB = rackNodes[i+1]
        if (!idA || !idB) continue

        const transformA = transformMap.get(idA)
        const transformB = transformMap.get(idB)
        if (!transformA || !transformB) continue

        const slotA = transformA.slotIndex ?? 0
        const heightA = transformA.uHeight ?? 1
        const slotB = transformB.slotIndex ?? 0

        // Solid-to-solid conduction occurs if and only if Node B is stacked directly on top of Node A
        const isTouching = slotB === slotA + heightA
        if (!isTouching) continue
        
        const thermalA = thermalMap.get(idA)
        const thermalB = thermalMap.get(idB)
        if (!thermalA || !thermalB) continue
        
        const diff = (thermalA.temperature - thermalB.temperature) * ThermalSystem.CONDUCTION_COEFFICIENT * dt
        
        thermalA.temperature -= diff
        thermalB.temperature += diff
      }
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
