import { System } from '../System'
import type { PowerComponent, TransformComponent, ThermalComponent, ApplicationComponent, RackComponent } from '../types'

/**
 * PowerSystem
 * ECS implementation of power distribution, load balancing, dual-feed redundancy, 
 * dynamic utilization scaling, 3-phase balancing, apparent power, UPS backup, 
 * and sustained circuit breaker tripping.
 */
export class PowerSystem extends System {
  // Global grid feed state (Phase A and Phase B power lines from utility transformer)
  public static facilityFeeds = {
    A: true,
    B: true
  }

  public update(dt: number) {
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const entities = this.world.getEntitiesWith(['power', 'transform'])

    // Separate racks and node entities
    const racks: string[] = []
    const deviceNodes: string[] = []

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        racks.push(id)
      } else {
        deviceNodes.push(id)
      }
    })

    // 1. Process UPS battery status and main power status for each Rack PDU
    racks.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)

      if (rackPower && rackComp) {
        // Initialize UPS capacity
        if (rackPower.upsMaxBatterySeconds === undefined) {
          rackPower.upsMaxBatterySeconds = 30.0
        }
        if (rackPower.upsBatterySeconds === undefined) {
          rackPower.upsBatterySeconds = rackPower.upsMaxBatterySeconds
        }

        // Breaker Tripped status
        if (rackPower.breakerTripped) {
          rackPower.isPowered = false
          rackPower.load = 0
          rackPower.apparentPowerVA = 0
          rackPower.upsBatterySeconds = 0
          rackComp.status = 'power_overload'
          return
        }

        // Check utility feeds for this rack PDU
        const rackFeed = rackPower.feedSource ?? 'both'
        let hasGridPower = true
        if (rackFeed === 'A' && !PowerSystem.facilityFeeds.A) {
          hasGridPower = false
        } else if (rackFeed === 'B' && !PowerSystem.facilityFeeds.B) {
          hasGridPower = false
        } else if (rackFeed === 'both' && !PowerSystem.facilityFeeds.A && !PowerSystem.facilityFeeds.B) {
          hasGridPower = false
        }

        if (hasGridPower) {
          // Normal state: Grid is supplying power. PDU is online and UPS is charging.
          rackPower.isPowered = true
          // UPS battery charges back up at 2x rate
          rackPower.upsBatterySeconds = Math.min(
            rackPower.upsMaxBatterySeconds,
            rackPower.upsBatterySeconds + dt * 2.0
          )
        } else {
          // Outage state: Grid is down. UPS battery discharge kicks in to prevent instant crash.
          if (rackPower.upsBatterySeconds > 0) {
            rackPower.isPowered = true
            rackPower.upsBatterySeconds = Math.max(0, rackPower.upsBatterySeconds - dt)
            
            // Publish transient power alert if battery is dropping
            if (rackPower.upsBatterySeconds < rackPower.upsMaxBatterySeconds - dt && rackPower.upsBatterySeconds > 0) {
              const remaining = Math.round(rackPower.upsBatterySeconds)
              if (remaining % 10 === 0 || remaining <= 5) {
                this.world.eventBus.publish('system:alert', {
                  entityId: rackId,
                  message: `WARNING: Utility power loss! Rack PDU [${transformMap.get(rackId)?.name || rackId}] running on UPS backup battery (${remaining}s remaining).`,
                  severity: 'warning'
                })
              }
            }
          } else {
            // UPS backup depleted
            rackPower.isPowered = false
            rackPower.load = 0
            rackPower.apparentPowerVA = 0
          }
        }
      }
    })

    // 2. Process Power Feed Losses and Dynamic Wattage Scaling for computing/device nodes
    deviceNodes.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)!
      const thermal = thermalMap.get(id)

      // Initialize base wattage
      if (power.baseWattage === undefined) {
        power.baseWattage = power.wattage || 300
      }

      // Initialize slot-based alternating phase layout
      if (!power.phase) {
        power.phase = transform.slotIndex !== undefined
          ? (['A', 'B', 'C'][transform.slotIndex % 3] as 'A' | 'B' | 'C')
          : 'A'
      }

      // Standby UPS battery default for standalone nodes (10s if not slotted in a rack)
      if (!transform.parentRackId) {
        if (power.upsMaxBatterySeconds === undefined) {
          power.upsMaxBatterySeconds = 10.0
        }
        if (power.upsBatterySeconds === undefined) {
          power.upsBatterySeconds = power.upsMaxBatterySeconds
        }
      }

      // Check grid power feeds for standalone devices
      const feed = power.feedSource ?? 'both'
      let hasGridPower = true
      if (feed === 'A' && !PowerSystem.facilityFeeds.A) {
        hasGridPower = false
      } else if (feed === 'B' && !PowerSystem.facilityFeeds.B) {
        hasGridPower = false
      } else if (feed === 'both' && !PowerSystem.facilityFeeds.A && !PowerSystem.facilityFeeds.B) {
        hasGridPower = false
      }

      // Check if breaker is tripped (either direct breaker or parent rack breaker)
      let parentPowered = true
      let parentTripped = false
      if (transform.parentRackId) {
        const rackPower = powerMap.get(transform.parentRackId)
        if (rackPower) {
          parentPowered = rackPower.isPowered
          parentTripped = rackPower.breakerTripped ?? false
        }
      }

      const isBreakerCut = power.breakerTripped || parentTripped

      if (isBreakerCut) {
        power.isPowered = false
        power.wattage = 0
        power.load = 0
        power.apparentPowerVA = 0
        return
      }

      // Power state determination: inherit from parent rack or use grid + personal battery
      if (transform.parentRackId) {
        power.isPowered = parentPowered
      } else {
        // Standalone node UPS logic
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

      if (!power.isPowered) {
        power.wattage = 0
        power.load = 0
        power.apparentPowerVA = 0
        return
      }

      // Compute dynamic utilization based on running applications deployed on this node
      const runningApps = this.world.getEntitiesWith(['application']).filter(appId => {
        const app = this.world.getComponent<ApplicationComponent>('application', appId)
        return app?.nodeId === id && app?.status === 'running'
      })
      const utilization = Math.min(100.0, runningApps.length * 30.0)
      const fanSpeed = thermal?.fanSpeedPercent ?? 0.0

      // Calculate internal DC hardware power draw
      const internalDCWattage = power.baseWattage * (1.0 + (utilization / 100.0) * 0.5) + (fanSpeed / 100.0) * 50.0

      // Factor in PSU AC Conversion efficiency losses
      const efficiency = power.efficiency ?? 0.85
      const dynamicWattage = internalDCWattage / efficiency

      // Calculate Dynamic Power Factor PFC curve (improves under heavy utilization)
      const powerFactor = Math.max(0.85, Math.min(0.99, 0.85 + 0.13 * (utilization / 100.0)))
      power.powerFactor = powerFactor

      // Calculate Apparent Power S (VA)
      power.apparentPowerVA = dynamicWattage / powerFactor

      power.wattage = dynamicWattage
      power.load = dynamicWattage / 1000.0 // kWE
    })

    // 3. Sum child power draw to compile 3-Phase PDU rack loads
    racks.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      if (!rackPower.isPowered) {
        rackPower.load = 0
        rackPower.apparentPowerVA = 0
        rackPower.phaseLoadsWatts = [0, 0, 0]
        rackPower.phaseLoadsVA = [0, 0, 0]
        return
      }

      // Local 3-phase accumulator [Phase A, Phase B, Phase C]
      const phaseWatts: [number, number, number] = [0, 0, 0]
      const phaseVA: [number, number, number] = [0, 0, 0]

      deviceNodes.forEach(id => {
        const transform = transformMap.get(id)!
        if (transform.parentRackId === rackId) {
          const childPower = powerMap.get(id)
          if (childPower && childPower.isPowered) {
            const serverPhase = childPower.phase ?? 'A'
            const phaseIndex = serverPhase === 'A' ? 0 : serverPhase === 'B' ? 1 : 2
            phaseWatts[phaseIndex] += childPower.wattage
            phaseVA[phaseIndex] += childPower.apparentPowerVA ?? childPower.wattage
          }
        }
      })

      // Sum totals
      const totalWatts = phaseWatts[0] + phaseWatts[1] + phaseWatts[2]
      const totalVA = phaseVA[0] + phaseVA[1] + phaseVA[2]

      rackPower.phaseLoadsWatts = phaseWatts
      rackPower.phaseLoadsVA = phaseVA

      rackPower.wattage = totalWatts
      rackPower.apparentPowerVA = totalVA
      rackPower.load = totalWatts / 1000.0
    })

    // 4. Update Rack status, timers, and trigger phase or total overload breaker trips
    racks.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      const transform = transformMap.get(rackId)
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)

      if (rackPower && rackComp) {
        if (rackPower.breakerTripped) {
          rackPower.isPowered = false
          rackPower.load = 0
          rackPower.apparentPowerVA = 0
          rackComp.status = 'power_overload'
          return
        }

        const maxLimit = rackComp.maxPowerKW ?? 5.0
        const totalLoadKW = rackPower.load

        // Each individual phase has a max rated capacity of maxPower / 3, with 15% imbalance tolerance
        const maxPhaseLimitKW = (maxLimit / 3.0) * 1.15

        const phaseA_KW = (rackPower.phaseLoadsWatts?.[0] ?? 0) / 1000.0
        const phaseB_KW = (rackPower.phaseLoadsWatts?.[1] ?? 0) / 1000.0
        const phaseC_KW = (rackPower.phaseLoadsWatts?.[2] ?? 0) / 1000.0
        const maxPhaseKW = Math.max(phaseA_KW, phaseB_KW, phaseC_KW)

        // Overload checking: either total load exceeds maxLimit OR any phase exceeds single-phase capacity
        const isTotalOverloaded = totalLoadKW > maxLimit
        const isPhaseOverloaded = maxPhaseKW > maxPhaseLimitKW
        const isOverloaded = isTotalOverloaded || isPhaseOverloaded

        if (isOverloaded) {
          const prevOverloadTime = rackPower.overloadSeconds ?? 0
          const nextOverloadTime = prevOverloadTime + dt
          rackPower.overloadSeconds = nextOverloadTime

          // Sustain overload for 10 seconds triggers PDU physical circuit breaker trip
          if (nextOverloadTime >= 10.0) {
            rackPower.breakerTripped = true
            rackPower.isPowered = false
            rackPower.load = 0
            rackPower.apparentPowerVA = 0
            rackPower.overloadSeconds = 0
            rackComp.status = 'power_overload'

            // Force all children inside rack off
            deviceNodes.forEach(childId => {
              const childTransform = transformMap.get(childId)!
              if (childTransform.parentRackId === rackId) {
                const childPower = powerMap.get(childId)
                if (childPower) {
                  childPower.isPowered = false
                  childPower.wattage = 0
                  childPower.load = 0
                  childPower.apparentPowerVA = 0
                }
              }
            })

            // Construct specific details of breaker trip reasons
            let tripMessage = `CRITICAL: Rack PDU Breaker TRIPPED on [${transform?.name || rackId}] due to prolonged `
            if (isPhaseOverloaded && !isTotalOverloaded) {
              tripMessage += `Phase Imbalance! Max phase load exceeded safety limit (${maxPhaseKW.toFixed(2)} kW > ${maxPhaseLimitKW.toFixed(2)} kW).`
            } else {
              tripMessage += `total power overload (${totalLoadKW.toFixed(2)} kW > ${maxLimit.toFixed(2)} kW)!`
            }

            // Publish alert to main event stream
            this.world.eventBus.publish('system:alert', {
              entityId: rackId,
              message: tripMessage,
              severity: 'critical'
            })
          }
        } else {
          // Recover overload counter if draw returns below threshold
          rackPower.overloadSeconds = 0
        }
      }
    })
  }
}
