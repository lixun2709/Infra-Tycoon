import type { ThermalComponent, PowerComponent, TransformComponent } from '../../types'
import type { ComponentMap } from '../../types'
import { ECSEventBus } from '../../EventBus'
import { LoadStats, ThermalGlobals } from './ThermalGlobals'

export class RoomAmbientEngine {
  /**
   * Computes room-level thermodynamic inertia, temperature dispersion, and dynamic relative humidity.
   */
  public static processRoomThermodynamics(
    siteLoadsPool: Map<string, LoadStats>,
    cracUnitsBySitePool: Map<string, string[]>,
    powerMap: ComponentMap<PowerComponent>,
    thermalMap: ComponentMap<ThermalComponent>,
    transformMap: ComponentMap<TransformComponent>,
    dt: number,
    eventBus: ECSEventBus
  ) {
    siteLoadsPool.forEach((load, siteId) => {
      const currentAmbient = ThermalGlobals.siteAmbientTemps.get(siteId) ?? ThermalGlobals.BASE_AMBIENT_TEMP
      const currentHumidity = ThermalGlobals.siteAmbientHumidity.get(siteId) ?? 45.0

      const netBTU = load.serverHeatBTU - load.coolingBTU
      const roomTargetTemp = ThermalGlobals.BASE_AMBIENT_TEMP + (netBTU / ThermalGlobals.ROOM_DISPERSION_COEFF)
      const roomTargetClamped = Math.max(15.0, Math.min(60.0, roomTargetTemp))

      const roomAlpha = 1.0 - Math.exp(-dt / ThermalGlobals.ROOM_TIME_CONSTANT)
      const nextAmbient = currentAmbient + (roomTargetClamped - currentAmbient) * roomAlpha

      ThermalGlobals.siteAmbientTemps.set(siteId, nextAmbient)

      // Dynamic Relative Humidity (RH) calculations
      // Count active running CRAC units in this site room
      const cracList = cracUnitsBySitePool.get(siteId) ?? []
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
      ThermalGlobals.siteAmbientHumidity.set(siteId, nextHumidity)

      // Alert/Safeguards for room humidity levels
      if (nextHumidity > 80.0 && currentHumidity <= 80.0) {
        eventBus.publish('system:alert', {
          entityId: siteId,
          message: `CRITICAL: High relative humidity in room ${siteId} (${nextHumidity.toFixed(1)}% RH). Extreme risk of condensation and short-circuits!`,
          severity: 'critical'
        })
      } else if (nextHumidity < 20.0 && currentHumidity >= 20.0) {
        eventBus.publish('system:alert', {
          entityId: siteId,
          message: `WARNING: Low relative humidity in room ${siteId} (${nextHumidity.toFixed(1)}% RH). Electrostatic discharge (ESD) threat level high!`,
          severity: 'warning'
        })
      }
    })
  }
}
