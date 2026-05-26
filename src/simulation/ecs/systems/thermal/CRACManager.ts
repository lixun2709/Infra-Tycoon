import type { ThermalComponent, PowerComponent, TransformComponent } from '../../types'
import type { ComponentMap } from '../../types'
import { ECSEventBus } from '../../EventBus'
import { LoadStats, ThermalGlobals } from './ThermalGlobals'

export class CRACManager {
  /**
   * Evaluates N+1 redundancy, Lead-Lag scheduling, standby assignments, and CRAC unit BTU calculations.
   */
  public static processCRACUnits(
    coolingUnitsPool: readonly string[],
    cracUnitsBySitePool: Map<string, string[]>,
    siteStandbyMapPool: Map<string, Set<string>>,
    activeHeatBySitePool: Map<string, number>,
    siteLoadsPool: Map<string, LoadStats>,
    rackLoadsPool: Map<string, LoadStats>,
    thermalMap: ComponentMap<ThermalComponent>,
    powerMap: ComponentMap<PowerComponent>,
    transformMap: ComponentMap<TransformComponent>,
    accumulatedTime: number,
    dt: number,
    eventBus: ECSEventBus
  ) {
    // V2 Lead-Lag Redundancy Scheduler
    // Cycle standby assignments every 60 simulated seconds for even degradation
    const currentCycle = Math.floor(accumulatedTime / 60.0)

    cracUnitsBySitePool.forEach((units, siteId) => {
      const roomAmbientTemp = ThermalGlobals.siteAmbientTemps.get(siteId) ?? ThermalGlobals.BASE_AMBIENT_TEMP
      const roomHeatLoad = activeHeatBySitePool.get(siteId) ?? 0

      // Filter out In-Row units which cool racks directly, and sort deterministically
      const roomUnits = units.filter(cracId => !transformMap.get(cracId)?.parentRackId)
      roomUnits.sort()
      
      const totalCoolingCapacity = roomUnits.reduce((sum, cracId) => {
        const thermal = thermalMap.get(cracId)
        return sum + (thermal ? Math.abs(thermal.btuOutput) : 0)
      }, 0)

      let standbySet = siteStandbyMapPool.get(siteId)
      if (!standbySet) {
        standbySet = new Set<string>()
        siteStandbyMapPool.set(siteId, standbySet)
      }

      // Standby criteria: We have N+1 redundant capacity, room is not overheating (>26°C), and we have multiple CRACs
      if (roomUnits.length >= 2 && roomAmbientTemp < 26.0 && totalCoolingCapacity > roomHeatLoad * 1.5) {
        // Calculate how many units we can put in standby. 
        // We must keep enough active units to cover 1.2x room heat load.
        let activeCapacity = 0
        const requiredCapacity = roomHeatLoad * 1.2

        for (let i = 0; i < roomUnits.length; i++) {
          const rotationIndex = (i + currentCycle) % roomUnits.length
          const cracId = roomUnits[rotationIndex]!
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

    // Process Cooling units - calculate dynamic efficiency, throttling, and safety shutdowns
    coolingUnitsPool.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalGlobals.siteAmbientTemps.get(siteId) ?? ThermalGlobals.BASE_AMBIENT_TEMP

      const isStandby = siteStandbyMapPool.get(siteId)?.has(id) ?? false
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
            eventBus.publish('system:alert', {
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
              eventBus.publish('system:alert', {
                entityId: id,
                message: `WARNING: Cooling unit ${coolingName} is throttled due to high room temperature (${roomAmbientTemp.toFixed(1)}°C). Capacity cut smoothly.`,
                severity: 'warning'
              })
            }
          } else if (thermal.isThrottled && roomAmbientTemp < 45.0) {
            thermal.isThrottled = false
            eventBus.publish('system:alert', {
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
      thermal.accumulatedSimTime = accumulatedTime
      thermal.lastUpdate = Math.floor(accumulatedTime * 1000)

      if (isRunning && effectiveCoolingBTU > 0) {
        if (transform.parentRackId) {
          // In-Row CRAC cooling specific rack micro-climate
          const rackLoad = rackLoadsPool.get(transform.parentRackId)
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
        } else {
          // Room-level CRAC unit
          const siteLoad = siteLoadsPool.get(siteId)
          if (siteLoad) {
            siteLoad.coolingBTU += effectiveCoolingBTU
          }
        }
      }
    })
  }
}
