import type { PowerComponent, TransformComponent, RackComponent } from '../../types'
import type { EventBus } from '../../EventBus'

export class UPSManager {
  /**
   * Processes UPS battery status and main power status for a Rack PDU.
   */
  public static processRackUPS(
    dt: number,
    rackId: string,
    power: PowerComponent,
    rackComp: RackComponent,
    transform: TransformComponent | undefined,
    facilityFeeds: { A: boolean; B: boolean },
    eventBus: EventBus
  ) {
    if (power.upsMaxBatterySeconds === undefined) power.upsMaxBatterySeconds = 30.0
    if (power.upsBatterySeconds === undefined) power.upsBatterySeconds = power.upsMaxBatterySeconds

    if (power.breakerTripped) {
      power.isPowered = false
      power.load = 0
      power.apparentPowerVA = 0
      power.upsBatterySeconds = 0
      rackComp.status = 'power_overload'
      return
    }

    const rackFeed = power.feedSource ?? 'both'
    let hasGridPower = true
    if (rackFeed === 'A' && !facilityFeeds.A) hasGridPower = false
    else if (rackFeed === 'B' && !facilityFeeds.B) hasGridPower = false
    else if (rackFeed === 'both' && !facilityFeeds.A && !facilityFeeds.B) hasGridPower = false

    if (hasGridPower) {
      power.isPowered = true
      power.upsBatterySeconds = Math.min(power.upsMaxBatterySeconds, power.upsBatterySeconds + dt * 2.0)
    } else {
      if (power.upsBatterySeconds > 0) {
        power.isPowered = true
        power.upsBatterySeconds = Math.max(0, power.upsBatterySeconds - dt)
        
        if (power.upsBatterySeconds < power.upsMaxBatterySeconds - dt && power.upsBatterySeconds > 0) {
          const remaining = Math.round(power.upsBatterySeconds)
          if (remaining % 10 === 0 || remaining <= 5) {
            eventBus.publish('system:alert', {
              entityId: rackId,
              message: `WARNING: Utility power loss! Rack PDU [${transform?.name || rackId}] running on UPS backup battery (${remaining}s remaining).`,
              severity: 'warning'
            })
          }
        }
      } else {
        power.isPowered = false
        power.load = 0
        power.apparentPowerVA = 0
      }
    }
  }

  /**
   * Processes UPS battery status and main power status for a standalone node.
   */
  public static processStandaloneUPS(
    dt: number,
    power: PowerComponent,
    facilityFeeds: { A: boolean; B: boolean }
  ) {
    if (power.upsMaxBatterySeconds === undefined) power.upsMaxBatterySeconds = 10.0
    if (power.upsBatterySeconds === undefined) power.upsBatterySeconds = power.upsMaxBatterySeconds

    const feed = power.feedSource ?? 'both'
    let hasGridPower = true
    if (feed === 'A' && !facilityFeeds.A) hasGridPower = false
    else if (feed === 'B' && !facilityFeeds.B) hasGridPower = false
    else if (feed === 'both' && !facilityFeeds.A && !facilityFeeds.B) hasGridPower = false

    if (hasGridPower) {
      power.isPowered = true
      power.upsBatterySeconds = Math.min(power.upsMaxBatterySeconds!, power.upsBatterySeconds! + dt * 2.0)
    } else {
      if (power.upsBatterySeconds! > 0) {
        power.isPowered = true
        power.upsBatterySeconds = Math.max(0, power.upsBatterySeconds! - dt)
      } else {
        power.isPowered = false
      }
    }
  }
}
