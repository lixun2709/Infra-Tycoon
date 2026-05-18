import { System } from '../System'
import type { ThermalComponent, PowerComponent, TransformComponent } from '../types'

/**
 * ThermalSystem
 * ECS implementation of thermodynamic simulation.
 * Handles conduction, convection, zone-localized site cooling, dynamic server fans, and safety shutdowns.
 */
export class ThermalSystem extends System {
  public static siteAmbientTemps = new Map<string, number>()

  private static CONDUCTION_COEFFICIENT = 0.05
  private static CONVECTION_COEFFICIENT = 0.02
  private static BASE_AMBIENT_TEMP = 22.0
  private static DEFAULT_CRITICAL = 80.0 // Silicon shutdown limit
  private static DEFAULT_THROTTLE = 70.0 // Performance throttling limit
  private static SITE_THERMAL_MASS = 12000.0 // Room air heat absorption threshold

  public update(dt: number) {
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    const entities = this.world.getEntitiesWith(['thermal', 'transform'])

    // 1. Calculate Localized Site Ambient Temperatures based on heat/cooling loads
    const siteLoads = new Map<string, { serverHeatBTU: number; coolingBTU: number }>()

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)
      const thermal = thermalMap.get(id)!

      const siteId = transform.siteId || 'default-site'
      if (!siteLoads.has(siteId)) {
        siteLoads.set(siteId, { serverHeatBTU: 0, coolingBTU: 0 })
      }
      const load = siteLoads.get(siteId)!

      const isRunning = power?.isPowered ?? false

      if (transform.type === 'cooling') {
        if (isRunning) {
          // Negative btuOutput is cooling capacity (e.g. -50000)
          load.coolingBTU += Math.abs(thermal.btuOutput)
        }
      } else if (transform.type !== 'rack') {
        if (isRunning) {
          // Heat load generated dynamically by server usage
          const efficiency = power?.efficiency ?? 0.8
          const activeWattage = (power?.wattage ?? 300) * (power?.load ?? 0.2)
          const serverHeatBTU = activeWattage * 3.41 * (1.1 - efficiency)
          load.serverHeatBTU += Math.max(10.0, serverHeatBTU)
        } else {
          load.serverHeatBTU += 0.5 // Minimal ambient heat in idle state
        }
      }
    })

    // Compute new ambient temperature for each site
    siteLoads.forEach((load, siteId) => {
      const currentAmbient = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP
      const netBTU = load.serverHeatBTU - load.coolingBTU
      const ambientChange = (netBTU / ThermalSystem.SITE_THERMAL_MASS) * dt
      
      let nextAmbient = currentAmbient + ambientChange

      // Natural environmental heat dispersion towards standard temperature
      const dispersion = (ThermalSystem.BASE_AMBIENT_TEMP - nextAmbient) * 0.02 * dt
      nextAmbient = nextAmbient + dispersion

      // Clamp ambient room temp between safe margins
      nextAmbient = Math.min(60.0, Math.max(15.0, nextAmbient))
      ThermalSystem.siteAmbientTemps.set(siteId, nextAmbient)
    })

    // 2. Process per-entity heat dynamics, fan speeds, and alarms
    entities.forEach(id => {
      const thermal = thermalMap.get(id)!
      const power = powerMap.get(id)
      const transform = transformMap.get(id)!

      if (transform.type === 'rack' || transform.type === 'cooling') return

      const siteId = transform.siteId || 'default-site'
      const ambientTemp = ThermalSystem.siteAmbientTemps.get(siteId) ?? ThermalSystem.BASE_AMBIENT_TEMP

      const isRunning = power?.isPowered ?? false

      // Calculate dynamic active fan speed percent based on target temperature curve
      const currentTemp = thermal.temperature
      const targetFanSpeed = isRunning
        ? 20.0 + 80.0 * Math.min(1.0, Math.max(0.0, (currentTemp - 35.0) / 35.0))
        : 0.0 // Turned off completely if powered down!
      
      // Fan mechanical inertia interpolation with overshoot protection
      const fanInertiaCoeff = isRunning ? 3.0 : 6.0
      const alpha = Math.min(1.0, fanInertiaCoeff * dt)
      const newFanSpeed = thermal.fanSpeedPercent + (targetFanSpeed - thermal.fanSpeedPercent) * alpha
      thermal.fanSpeedPercent = Math.min(
        100.0,
        Math.max(
          isRunning ? 20.0 : 0.0,
          newFanSpeed
        )
      )

      // Dynamic fan wattage load penalty: higher speed draws up to 50W extra
      if (isRunning && power) {
        const fanPenaltyKW = (thermal.fanSpeedPercent / 100.0) * 0.05
        power.load = Math.min(1.0, power.load + fanPenaltyKW)
      }

      // Enhanced convection cooling coefficient scaled by fan spin rate
      const convectionCoeff = ThermalSystem.CONVECTION_COEFFICIENT * (1.0 + thermal.fanSpeedPercent / 100.0)
      const convection = (currentTemp - ambientTemp) * convectionCoeff * dt

      // dynamic server heat equation
      const efficiency = power?.efficiency ?? 0.8
      const dynamicWattage = isRunning ? (power?.wattage ?? 300) * (power?.load ?? 0.2) : 0
      const serverHeat = isRunning ? dynamicWattage * 0.001 * (1.2 - efficiency) : 0.01

      const nextTemp = currentTemp + (serverHeat * dt * 45.0) - convection

      // Thermal Safety Thresholds & Alarm Event Publishing
      const throttle = ThermalSystem.DEFAULT_THROTTLE
      const critical = ThermalSystem.DEFAULT_CRITICAL

      if (nextTemp > critical) {
        // High-temperature silicon guard shutdown
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
      thermal.lastUpdate = Date.now()
    })

    // 3. Conduction between adjacent entities in the same rack (optimized O(N) single-pass grouping)
    const rackChildrenMap = new Map<string, string[]>()
    const racks: string[] = []

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        racks.push(id)
      } else if (transform.parentRackId) {
        if (!rackChildrenMap.has(transform.parentRackId)) {
          rackChildrenMap.set(transform.parentRackId, [])
        }
        rackChildrenMap.get(transform.parentRackId)!.push(id)
      }
    })

    racks.forEach(rackId => {
      const rackNodes = rackChildrenMap.get(rackId)
      if (!rackNodes || rackNodes.length < 2) return

      // Sort only the local rack nodes
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
