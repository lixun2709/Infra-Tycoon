import { System } from '../System'
import type { ThermalComponent, PowerComponent, TransformComponent } from '../types'
import { HARDWARE_CATALOG, type HardwareCatalogSpec } from '../../../physics/hardwareLibrary'

/**
 * ThermalSystem
 * ECS implementation of thermodynamic simulation.
 * Handles conduction, convection, zone-localized site cooling, dynamic server fans, rack micro-climates, and safety shutdowns.
 */
export class ThermalSystem extends System {
  public static siteAmbientTemps = new Map<string, number>()
  public static siteAmbientHumidity = new Map<string, number>() // V2 room relative humidity %

  private accumulatedTime = 0.0 // V2 multiplayer-safe deterministic elapsed time (seconds)

  private static CONDUCTION_COEFFICIENT = 0.05 / 9.0
  private static CONVECTION_COEFFICIENT = 0.02 / 9.0
  private static BASE_AMBIENT_TEMP = 22.0
  private static DEFAULT_CRITICAL = 80.0 // Silicon shutdown limit
  private static DEFAULT_THROTTLE = 70.0 // Performance throttling limit
  private static SITE_THERMAL_MASS = 108000.0 // Room air heat absorption threshold (12000.0 * 9.0)
  private static RACK_THERMAL_MASS = 13500.0 // Rack localized containment air heat threshold (1500.0 * 9.0)

  public update(dt: number) {
    // 1. Advance deterministic time tracking
    this.accumulatedTime += dt

    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    const entities = this.world.getEntitiesWith(['thermal', 'transform'])

    // Separate lists for organization
    const racks: string[] = []
    const coolingUnits: string[] = []
    const chassisNodes: string[] = []

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        racks.push(id)
      } else if (transform.type === 'cooling') {
        coolingUnits.push(id)
      } else {
        chassisNodes.push(id)
      }
    })

    // Pre-calculate server heat loads by site for Lead-Lag scheduler and N+1 calculations
    const activeHeatBySite = new Map<string, number>()
    chassisNodes.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const siteId = transform.siteId || 'default-site'
      const isRunning = power?.isPowered ?? false

      let serverHeatBTU = 0.5 // Minimal ambient heat in idle state
      if (isRunning) {
        const efficiency = power?.efficiency ?? 0.8
        const activeWattage = (power?.wattage ?? 300) * (power?.load ?? 0.2)
        serverHeatBTU = Math.max(10.0, activeWattage * 3.41 * (1.1 - efficiency))
      }
      activeHeatBySite.set(siteId, (activeHeatBySite.get(siteId) ?? 0) + serverHeatBTU)
    })

    // Group CRAC units by site room
    const cracUnitsBySite = new Map<string, string[]>()
    coolingUnits.forEach(id => {
      const transform = transformMap.get(id)!
      const siteId = transform.siteId || 'default-site'
      if (!cracUnitsBySite.has(siteId)) {
        cracUnitsBySite.set(siteId, [])
      }
      cracUnitsBySite.get(siteId)!.push(id)
    })

    // V2 Lead-Lag Redundancy Scheduler
    // Cycle standby assignments every 60 simulated seconds for even degradation
    const currentCycle = Math.floor(this.accumulatedTime / 60.0)
    const siteStandbyMap = new Map<string, Set<string>>()

    cracUnitsBySite.forEach((units, siteId) => {
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const roomHeatLoad = activeHeatBySite.get(siteId) ?? 0

      // Sort units deterministically by entityId for multiplayer stability
      const sortedUnits = [...units].sort()
      const totalCoolingCapacity = sortedUnits.reduce((sum, cracId) => {
        const thermal = thermalMap.get(cracId)
        return sum + (thermal ? Math.abs(thermal.btuOutput) : 0)
      }, 0)

      const standbySet = new Set<string>()

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
      siteStandbyMap.set(siteId, standbySet)
    })

    // 2. Initialize loads for sites and racks
    const siteLoads = new Map<string, { serverHeatBTU: number; coolingBTU: number }>()
    const rackLoads = new Map<string, { serverHeatBTU: number; coolingBTU: number }>()

    racks.forEach(id => {
      rackLoads.set(id, { serverHeatBTU: 0, coolingBTU: 0 })
    })

    // 3. Process Cooling units - calculate dynamic efficiency, throttling, and safety shutdowns
    coolingUnits.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP

      const isStandby = siteStandbyMap.get(siteId)?.has(id) ?? false
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
        } else if (roomAmbientTemp > 50.0) {
          // Performance Throttling
          efficiency = 0.5
          if (!thermal.isThrottled) {
            thermal.isThrottled = true
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Cooling unit ${coolingName} is throttled due to high room temperature (${roomAmbientTemp.toFixed(1)}°C). Capacity cut to 50%.`,
              severity: 'warning'
            })
          }
        } else if (thermal.isThrottled && roomAmbientTemp < 45.0) {
          // Recovery
          thermal.isThrottled = false
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `INFO: Cooling unit ${coolingName} thermal throttling cleared.`,
            severity: 'info'
          })
        }
      } else {
        efficiency = 0.0
      }

      // Degradation scale factor (1.0 - degradationPercent / 100)
      const degradationFactor = Math.max(0.0, Math.min(1.0, 1.0 - (transform.degradation ?? 0.0) / 100.0))
      let effectiveCoolingBTU = Math.abs(thermal.btuOutput) * efficiency * degradationFactor

      if (isRunning && effectiveCoolingBTU > 0) {
        if (transform.parentRackId) {
          // In-Row CRAC cooling specific rack micro-climate
          const rackLoad = rackLoads.get(transform.parentRackId)
          if (rackLoad) {
            // Apply aisle containment cooling efficiency multiplier
            const parentRackThermal = thermalMap.get(transform.parentRackId)
            const containment = parentRackThermal?.containmentType ?? 'none'
            if (containment === 'cold_aisle') {
              effectiveCoolingBTU *= 2.0 // Cold aisle isolates air delivery, doubling cooling efficiency
            } else if (containment === 'hot_aisle') {
              effectiveCoolingBTU *= 1.5 // Hot aisle containment direct returns
            }
            rackLoad.coolingBTU += effectiveCoolingBTU
          }
        }
        
        // Both general and In-Row CRAC units contribute to extracting net heat from the overall room!
        if (!siteLoads.has(siteId)) {
          siteLoads.set(siteId, { serverHeatBTU: 0, coolingBTU: 0 })
        }
        siteLoads.get(siteId)!.coolingBTU += effectiveCoolingBTU
      }

      // Keep cooling unit temperature tracked
      thermal.temperature = Math.max(18.0, roomAmbientTemp - (isRunning ? 5.0 * efficiency : 0))
      thermal.accumulatedSimTime = this.accumulatedTime
      thermal.lastUpdate = Math.floor(this.accumulatedTime * 1000) // deterministic timestamp matching milliseconds
    })

    // 4. Process active server heat generation loads
    chassisNodes.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)

      const siteId = transform.siteId || 'default-site'
      const isRunning = power?.isPowered ?? false

      let serverHeatBTU = 0.5 // Minimal ambient heat in idle state
      if (isRunning) {
        const efficiency = power?.efficiency ?? 0.8
        const activeWattage = (power?.wattage ?? 300) * (power?.load ?? 0.2)
        serverHeatBTU = Math.max(10.0, activeWattage * 3.41 * (1.1 - efficiency))
      }

      // Add to specific rack load if mounted in a rack
      if (transform.parentRackId) {
        const rackLoad = rackLoads.get(transform.parentRackId)
        if (rackLoad) {
          rackLoad.serverHeatBTU += serverHeatBTU
        }
      }

      // Add to general site loads
      if (!siteLoads.has(siteId)) {
        siteLoads.set(siteId, { serverHeatBTU: 0, coolingBTU: 0 })
      }
      siteLoads.get(siteId)!.serverHeatBTU += serverHeatBTU
    })

    // 5. Calculate Rack Micro-climate Thermal Zone states
    racks.forEach(rackId => {
      const rackThermal = thermalMap.get(rackId)!
      const rackTransform = transformMap.get(rackId)!
      const siteId = rackTransform.siteId || 'default-site'
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP

      const containment = rackThermal.containmentType ?? 'none'
      const load = rackLoads.get(rackId) ?? { serverHeatBTU: 0, coolingBTU: 0 }
      const netBTU = load.serverHeatBTU - load.coolingBTU

      const currentRackTemp = rackThermal.temperature ?? roomAmbientTemp
      const tempChange = (netBTU / ThermalSystem.RACK_THERMAL_MASS) * dt

      // Convective exchange scaled by Aisle Containment configuration
      let convectionMult = 1.0
      if (containment === 'cold_aisle') {
        convectionMult = 0.2 // highly isolated, room ambient barely transfers heat
      } else if (containment === 'hot_aisle') {
        convectionMult = 0.4 // hot air exhausted directly out, reduced thermal transfer
      }

      const convectionExchange = (currentRackTemp - roomAmbientTemp) * (0.1 / 9.0) * convectionMult * dt

      let nextRackTemp = currentRackTemp + tempChange - convectionExchange
      nextRackTemp = Math.min(65.0, Math.max(16.0, nextRackTemp))

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

    // 6. Compute new global Ambient Temperatures & Relative Humidity for each site room
    siteLoads.forEach((load, siteId) => {
      const currentAmbient = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const currentHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0

      // Sum convection leakage from all racks within this site room
      let rackConvectionLeakage = 0
      racks.forEach(rackId => {
        const rackTransform = transformMap.get(rackId)!
        if (rackTransform.siteId === siteId) {
          const rackThermal = thermalMap.get(rackId)
          if (rackThermal) {
            const containment = rackThermal.containmentType ?? 'none'
            let convectionMult = 1.0
            if (containment === 'cold_aisle') {
              convectionMult = 0.2
            } else if (containment === 'hot_aisle') {
              convectionMult = 0.4
            }
            rackConvectionLeakage += (rackThermal.temperature - currentAmbient) * 0.05 * convectionMult
          }
        }
      })

      const netBTU = load.serverHeatBTU - load.coolingBTU + rackConvectionLeakage
      const ambientChange = (netBTU / ThermalSystem.SITE_THERMAL_MASS) * dt
      
      let nextAmbient = currentAmbient + ambientChange

      // Natural environmental heat dispersion towards standard room temp
      const dispersion = (ThermalSystem.BASE_AMBIENT_TEMP - nextAmbient) * (0.02 / 9.0) * dt
      nextAmbient = nextAmbient + dispersion
      nextAmbient = Math.min(60.0, Math.max(15.0, nextAmbient))
      ThermalSystem.siteAmbientTemps.set(siteId, nextAmbient)

      // Dynamic Relative Humidity (RH) calculations
      // Count active running CRAC units in this site room
      const cracList = cracUnitsBySite.get(siteId) ?? []
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
    chassisNodes.forEach(id => {
      const thermal = thermalMap.get(id)!
      const power = powerMap.get(id)
      const transform = transformMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const roomHumidity = ThermalSystem.siteAmbientHumidity.get(siteId) ?? 45.0

      // Local convective ambient: resolve to parent rack micro-climate if mounted
      let localAmbient = roomAmbientTemp
      let localHumidity = roomHumidity
      let hasActiveRackCooling = false
      if (transform.parentRackId) {
        const parentRackThermal = thermalMap.get(transform.parentRackId)
        if (parentRackThermal) {
          localAmbient = parentRackThermal.temperature
          localHumidity = parentRackThermal.humidity ?? roomHumidity
        }
        const load = rackLoads.get(transform.parentRackId)
        if (load && load.coolingBTU > 0) {
          hasActiveRackCooling = true
        }
      }

      thermal.humidity = localHumidity

      const isRunning = power?.isPowered ?? false

      // Calculate dynamic active fan speed percent based on target temperature curve
      const currentTemp = thermal.temperature
      const targetFanSpeed = isRunning
        ? 20.0 + 80.0 * Math.min(1.0, Math.max(0.0, (currentTemp - 35.0) / 35.0))
        : 0.0
      
      const fanInertiaCoeff = isRunning ? 3.0 : 6.0
      const alpha = Math.min(1.0, fanInertiaCoeff * dt)
      const newFanSpeed = thermal.fanSpeedPercent + (targetFanSpeed - thermal.fanSpeedPercent) * alpha
      thermal.fanSpeedPercent = Math.min(100.0, Math.max(isRunning ? 20.0 : 0.0, newFanSpeed))

      // Dynamic fan wattage load penalty: higher speed draws up to 50W extra
      if (isRunning && power) {
        const fanPenaltyKW = (thermal.fanSpeedPercent / 100.0) * 0.05
        power.load = Math.min(1.0, power.load + fanPenaltyKW)
      }

      // Enhanced convection cooling coefficient scaled by fan spin rate and active rack forced containment airflow
      const convectionCoeff = ThermalSystem.CONVECTION_COEFFICIENT * 
        (1.0 + thermal.fanSpeedPercent / 100.0) * 
        (hasActiveRackCooling ? 6.0 : 1.0)
      const convection = (currentTemp - localAmbient) * convectionCoeff * dt

      // Server active heat equation
      const spec = (transform.catalogKey ? HARDWARE_CATALOG[transform.catalogKey as keyof typeof HARDWARE_CATALOG] : null) as HardwareCatalogSpec | null
      const efficiency = spec?.heatEfficiency ?? power?.efficiency ?? 0.8
      const dynamicWattage = isRunning ? (power?.wattage ?? 300) * (power?.load ?? 0.2) : 0
      const serverHeat = isRunning ? dynamicWattage * 0.001 * (1.2 - efficiency) : 0.01

      const nextTemp = currentTemp + (serverHeat * dt * 1.0) - convection

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
    const rackChildrenMap = new Map<string, string[]>()

    chassisNodes.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.parentRackId) {
        if (!rackChildrenMap.has(transform.parentRackId)) {
          rackChildrenMap.set(transform.parentRackId, [])
        }
        rackChildrenMap.get(transform.parentRackId)!.push(id)
      }
    })

    racks.forEach(rackId => {
      const rackNodes = rackChildrenMap.get(rackId)
      if (!rackNodes || rackNodes.length < 2) return

      // Sort only local rack nodes by slotIndex
      rackNodes.sort((a, b) => (transformMap.get(a)?.slotIndex ?? 0) - (transformMap.get(b)?.slotIndex ?? 0))

      for (let i = 0; i < rackNodes.length - 1; i++) {
        const idA = rackNodes[i]
        const idB = rackNodes[i+1]
        if (!idA || !idB) continue
        
        const thermalA = thermalMap.get(idA)
        const thermalB = thermalMap.get(idB)
        if (!thermalA || !thermalB) continue
        
        const diff = (thermalA.temperature - thermalB.temperature) * ThermalSystem.CONDUCTION_COEFFICIENT * dt
        
        thermalA.temperature -= diff
        thermalB.temperature += diff
      }
    })
  }
}
