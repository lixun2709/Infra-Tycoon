import type { PowerComponent, TransformComponent, RackComponent } from '../../types'
import type { EventBus } from '../../EventBus'

export class BreakerManager {
  /**
   * Evaluates total load and phase imbalances against limits, managing overload timers and trip events.
   */
  public static evaluateRackBreaker(
    dt: number,
    rackId: string,
    rackPower: PowerComponent,
    rackComp: RackComponent,
    transform: TransformComponent | undefined,
    children: string[] | undefined,
    powerMap: Map<string, PowerComponent>,
    eventBus: EventBus
  ) {
    if (rackComp.status === 'power_overload' && !rackPower.breakerTripped) {
      console.log(`[PowerSystem] Detected BREAKER RESET or recovery initiation on Rack: ${rackId}. Re-evaluating...`)
    }

    if (rackPower.breakerTripped) {
      rackPower.isPowered = false
      rackPower.load = 0
      rackPower.apparentPowerVA = 0
      rackComp.status = 'power_overload'
      return
    }

    const nominalLimit = Number.isFinite(rackComp.maxPowerKW) && rackComp.maxPowerKW > 0 ? rackComp.maxPowerKW : 5.0
    const maxLimit = (rackComp.deratedMaxPowerKW !== undefined && Number.isFinite(rackComp.deratedMaxPowerKW)) ? rackComp.deratedMaxPowerKW : nominalLimit
    const totalLoadKW = Number.isFinite(rackPower.load) && !Number.isNaN(rackPower.load) ? rackPower.load : 0.0

    const maxPhaseLimitKW = (maxLimit / 3.0) * 1.15

    const phaseA_KW = (rackPower.phaseLoadsWatts?.[0] ?? 0) / 1000.0
    const phaseB_KW = (rackPower.phaseLoadsWatts?.[1] ?? 0) / 1000.0
    const phaseC_KW = (rackPower.phaseLoadsWatts?.[2] ?? 0) / 1000.0
    const maxPhaseKW = Math.max(phaseA_KW, phaseB_KW, phaseC_KW)

    const isTotalOverloaded = totalLoadKW > maxLimit
    const isPhaseOverloaded = maxPhaseKW > maxPhaseLimitKW
    const isOverloaded = isTotalOverloaded || isPhaseOverloaded

    if (isOverloaded) {
      const nextOverloadTime = (rackPower.overloadSeconds ?? 0) + dt
      rackPower.overloadSeconds = nextOverloadTime

      if (nextOverloadTime >= 10.0) {
        rackPower.breakerTripped = true
        rackPower.isPowered = false
        rackPower.load = 0
        rackPower.apparentPowerVA = 0
        rackPower.overloadSeconds = 0
        rackComp.status = 'power_overload'

        if (children) {
          for (let i = 0; i < children.length; i++) {
            const childId = children[i]
            if (!childId) continue
            const childPower = powerMap.get(childId)
            if (childPower) {
              childPower.isPowered = false
              childPower.wattage = 0
              childPower.load = 0
              childPower.apparentPowerVA = 0
              childPower.systemState = 'off'
            }
          }
        }

        let tripMessage = `CRITICAL: Rack PDU Breaker TRIPPED on [${transform?.name || rackId}] due to prolonged `
        if (isPhaseOverloaded && !isTotalOverloaded) {
          tripMessage += `Phase Imbalance! Max phase load exceeded safety limit (${maxPhaseKW.toFixed(2)} kW > ${maxPhaseLimitKW.toFixed(2)} kW).`
        } else {
          tripMessage += `total power overload (${totalLoadKW.toFixed(2)} kW > ${maxLimit.toFixed(2)} kW)!`
        }

        console.log(
          `[PowerSystem] BREAKER TRIP TRIGGERED on Rack Entity: ${rackId}. Total Load: ${totalLoadKW.toFixed(2)} kW / Max Limit: ${maxLimit.toFixed(2)} kW.`
        )

        eventBus.publish('system:alert', {
          entityId: rackId,
          message: tripMessage,
          severity: 'critical'
        })
      }
    } else {
      rackPower.overloadSeconds = 0
    }
  }
}
