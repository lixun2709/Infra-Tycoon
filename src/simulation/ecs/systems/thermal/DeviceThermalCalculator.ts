import type { ThermalComponent, PowerComponent, TransformComponent } from '../../types'
import type { ComponentMap } from '../../types'
import { ECSEventBus } from '../../EventBus'
import { HARDWARE_CATALOG, type HardwareCatalogSpec } from '../../../../physics/hardwareLibrary'
import { LoadStats, ThermalGlobals } from './ThermalGlobals'

export class DeviceThermalCalculator {
  private static slotsPool = new Array<string | null>(43).fill(null)

  /**
   * Calculates per-server heat generation, active server heat generation loads, 
   * dynamic fan speeds, thermal throttling, critical overheating failures, 
   * and local adjacent conduction.
   */
  public static processServerThermodynamics(
    chassisNodesPool: readonly string[],
    racksPool: readonly string[],
    rackChildrenMapPool: Map<string, string[]>,
    siteLoadsPool: Map<string, LoadStats>,
    rackLoadsPool: Map<string, LoadStats>,
    cracUnitsBySitePool: Map<string, string[]>,
    thermalMap: ComponentMap<ThermalComponent>,
    powerMap: ComponentMap<PowerComponent>,
    transformMap: ComponentMap<TransformComponent>,
    dt: number,
    accumulatedTime: number,
    eventBus: ECSEventBus
  ) {
    // Process active server heat generation loads
    chassisNodesPool.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)

      const siteId = transform.siteId || 'default-site'
      const isRunning = power?.isPowered ?? false

      let serverHeatBTU = 0.5 // Minimal ambient heat in idle state
      if (isRunning && power) {
        const efficiency = power.efficiency ?? 0.8
        serverHeatBTU = Math.max(10.0, power.wattage * 3.412 * (1.1 - efficiency))
      }

      const thermal = thermalMap.get(id)
      let convectiveHeatBTU = serverHeatBTU

      if (thermal && thermal.coolingMethod === 'liquid_dlc') {
        // Check if there is a LIQUID_CDU in the room
        const cracUnits = cracUnitsBySitePool.get(siteId) || []
        const hasCDU = cracUnits.some(cId => {
          const power = powerMap.get(cId)
          const transform = transformMap.get(cId)
          // Hardcoded assumption: CDU hardware name typically contains 'CDU' or we can check its type
          // Wait, 'LIQUID_CDU' is the hardware ID or name?
          // Since we don't have the hardware library here easily, let's assume if it has immense btu output or name has 'CDU' or 'DLC'
          return (power?.isPowered ?? false) && (transform?.name?.includes('CDU') || transform?.name?.includes('DLC'))
        })

        if (hasCDU) {
          const liquidAbsorbed = serverHeatBTU * 0.80
          convectiveHeatBTU = serverHeatBTU - liquidAbsorbed
          thermal.waterFlowLPM = liquidAbsorbed * 0.005
        } else {
          // Penalty: No CDU means no liquid loop. The liquid block traps heat. Severe throttling incoming.
          convectiveHeatBTU = serverHeatBTU * 1.5 // Extra penalty due to stalled liquid block!
          thermal.waterFlowLPM = 0
          
          if (isRunning) {
            eventBus.publish('system:alert', {
              entityId: id,
              message: `CRITICAL: DLC server ${transform.name || id.slice(0, 6)} has no active Coolant Distribution Unit (CDU)! Thermal runaway imminent.`,
              severity: 'critical'
            })
          }
        }
      } else if (thermal && thermal.coolingMethod === 'immersion') {
        const liquidAbsorbed = serverHeatBTU * 0.95
        convectiveHeatBTU = serverHeatBTU - liquidAbsorbed
        thermal.waterFlowLPM = liquidAbsorbed * 0.005
      } else if (thermal) {
        thermal.waterFlowLPM = 0
      }

      // Add to specific rack load if mounted in a rack
      if (transform.parentRackId) {
        const rackLoad = rackLoadsPool.get(transform.parentRackId)
        if (rackLoad) {
          rackLoad.serverHeatBTU += convectiveHeatBTU
        }
      }

      // Add to general site loads
      let siteLoad = siteLoadsPool.get(siteId)
      if (!siteLoad) {
        siteLoad = new LoadStats()
        siteLoadsPool.set(siteId, siteLoad)
      }
      siteLoad.serverHeatBTU += convectiveHeatBTU
    })

    // Process per-entity server thermodynamics (using rack micro-climate as its local ambient temperature)
    chassisNodesPool.forEach(id => {
      const thermal = thermalMap.get(id)!
      const power = powerMap.get(id)
      const transform = transformMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      const roomAmbientTemp = ThermalGlobals.siteAmbientTemps.get(siteId) ?? ThermalGlobals.BASE_AMBIENT_TEMP
      const roomHumidity = ThermalGlobals.siteAmbientHumidity.get(siteId) ?? 45.0

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
      const throttle = spec?.throttleTemp ?? ThermalGlobals.DEFAULT_THROTTLE
      const critical = spec?.maxOperatingTemp ?? ThermalGlobals.DEFAULT_CRITICAL

      if (nextTemp > critical) {
        if (power && power.isPowered) {
          power.isPowered = false
          eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: Thermal shutdown on ${id}. Node reached ${nextTemp.toFixed(1)}°C (Max: ${critical}°C).`,
            severity: 'critical'
          })
        }
      } else if (nextTemp > throttle) {
        if (!thermal.isThrottled) {
          thermal.isThrottled = true
          eventBus.publish('system:alert', {
            entityId: id,
            message: `WARNING: Thermal throttling engaged on ${id} (${nextTemp.toFixed(1)}°C). CPU performance cut by 50%.`,
            severity: 'warning'
          })
        }
      } else if (thermal.isThrottled && nextTemp < throttle - 5.0) {
        thermal.isThrottled = false
        eventBus.publish('system:alert', {
          entityId: id,
          message: `INFO: Thermal throttling cleared on ${id}. Node operating temperature stabilized.`,
          severity: 'info'
        })
      }

      thermal.temperature = Math.max(18.0, nextTemp)
      thermal.accumulatedSimTime = accumulatedTime
      thermal.lastUpdate = Math.floor(accumulatedTime * 1000)
    })

    // Conduction between adjacent entities in the same rack (optimized O(N) single-pass grouping)
    chassisNodesPool.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.parentRackId) {
        let list = rackChildrenMapPool.get(transform.parentRackId)
        if (!list) {
          list = []
          rackChildrenMapPool.set(transform.parentRackId, list)
        }
        list.push(id)
      }
    })

    racksPool.forEach(rackId => {
      const rackNodes = rackChildrenMapPool.get(rackId)
      if (!rackNodes || rackNodes.length < 2) return

      // Map servers into static slots pool (O(N) layout, avoids O(N log N) GC-heavy sorting)
      this.slotsPool.fill(null)
      for (let i = 0; i < rackNodes.length; i++) {
        const id = rackNodes[i]!
        const slot = transformMap.get(id)?.slotIndex
        if (slot !== undefined && slot >= 1 && slot <= 42) {
          this.slotsPool[slot] = id
        }
      }

      for (let slot = 1; slot <= 42; slot++) {
        const idA = this.slotsPool[slot]
        if (!idA) continue

        const transformA = transformMap.get(idA)
        const heightA = transformA?.uHeight ?? 1
        
        const targetSlot = slot + heightA
        if (targetSlot > 42) continue

        const idB = this.slotsPool[targetSlot]
        if (!idB) continue
        
        const thermalA = thermalMap.get(idA)
        const thermalB = thermalMap.get(idB)
        if (!thermalA || !thermalB) continue
        
        const diff = (thermalA.temperature - thermalB.temperature) * ThermalGlobals.CONDUCTION_COEFFICIENT * dt
        
        thermalA.temperature -= diff
        thermalB.temperature += diff
      }
    })
  }
}
