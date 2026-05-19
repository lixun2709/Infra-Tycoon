import { System } from '../System'
import type { PowerComponent, TransformComponent, ThermalComponent, ApplicationComponent, RackComponent } from '../types'

/**
 * PowerSystem
 * ECS implementation of power distribution, load balancing, dual-feed redundancy, 
 * dynamic utilization scaling, and sustained circuit breaker tripping.
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

    // 1. Process Power Feed Losses and Dynamic Wattage Scaling for computing nodes
    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') return // Racks handle aggregate load below

      const power = powerMap.get(id)!
      const thermal = thermalMap.get(id)

      // Establish base wattage
      if (power.baseWattage === undefined) {
        power.baseWattage = power.wattage || 300
      }

      // Check master utility grid feed status for this device
      const feed = power.feedSource ?? 'both'
      let hasGridPower = true
      if (feed === 'A' && !PowerSystem.facilityFeeds.A) {
        hasGridPower = false
      } else if (feed === 'B' && !PowerSystem.facilityFeeds.B) {
        hasGridPower = false
      } else if (feed === 'both' && !PowerSystem.facilityFeeds.A && !PowerSystem.facilityFeeds.B) {
        hasGridPower = false
      }

      // If the node's rack PDU breaker is tripped, it loses power
      let parentTripped = false
      if (transform.parentRackId) {
        const rackPower = powerMap.get(transform.parentRackId)
        if (rackPower && rackPower.breakerTripped) {
          parentTripped = true
        }
      }

      if (!hasGridPower || parentTripped || power.breakerTripped) {
        power.isPowered = false
        power.wattage = 0
        power.load = 0
        return
      }

      // Compute dynamic utilization based on running applications deployed on this node
      const runningApps = this.world.getEntitiesWith(['application']).filter(appId => {
        const app = this.world.getComponent<ApplicationComponent>('application', appId)
        return app?.nodeId === id && app?.status === 'running'
      })
      const utilization = Math.min(100.0, runningApps.length * 30.0)
      const fanSpeed = thermal?.fanSpeedPercent ?? 0.0

      // Dynamic wattage calculation: idle draw scaled by utilization plus cooling fan power draw
      const dynamicWattage = power.baseWattage * (1.0 + (utilization / 100.0) * 0.5) + (fanSpeed / 100.0) * 50.0
      power.wattage = power.isPowered ? dynamicWattage : 0.0
      power.load = power.wattage / 1000 // In kW
    })

    // 2. Sum child power draw to compile PDU rack loads
    const rackLoads = new Map<string, number>()
    const rackIds: string[] = []

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        rackIds.push(id)
        rackLoads.set(id, 0)
      }
    })

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.parentRackId && transform.type !== 'rack') {
        const childPower = powerMap.get(id)
        if (childPower && childPower.isPowered) {
          const currentLoad = rackLoads.get(transform.parentRackId) ?? 0
          rackLoads.set(transform.parentRackId, currentLoad + childPower.wattage)
        }
      }
    })

    // 3. Update Rack status, timers, and trigger prolonged breaker trips
    rackIds.forEach(rackId => {
      const rackPower = powerMap.get(rackId)
      const transform = transformMap.get(rackId)
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)

      if (rackPower && rackComp) {
        const totalWatts = rackLoads.get(rackId) ?? 0
        const totalLoadKW = totalWatts / 1000
        rackPower.load = totalLoadKW

        // Breaker Tripped Guard
        if (rackPower.breakerTripped) {
          rackPower.isPowered = false
          rackPower.load = 0
          rackComp.status = 'power_overload' // Keeps visual overlay matching
          return
        }

        const maxLimit = rackComp.maxPowerKW ?? 5.0

        if (totalLoadKW > maxLimit) {
          const prevOverloadTime = rackPower.overloadSeconds ?? 0
          const nextOverloadTime = prevOverloadTime + dt
          rackPower.overloadSeconds = nextOverloadTime

          // Sustain overload for 10 seconds triggers PDU physical circuit breaker trip
          if (nextOverloadTime >= 10.0) {
            rackPower.breakerTripped = true
            rackPower.isPowered = false
            rackPower.load = 0
            rackPower.overloadSeconds = 0
            rackComp.status = 'power_overload'

            // Force all children inside rack off
            entities.forEach(childId => {
              const childTransform = transformMap.get(childId)!
              if (childTransform.parentRackId === rackId && childTransform.type !== 'rack') {
                const childPower = powerMap.get(childId)
                if (childPower) {
                  childPower.isPowered = false
                  childPower.wattage = 0
                  childPower.load = 0
                }
              }
            })

            // Publish alert to main event stream
            this.world.eventBus.publish('system:alert', {
              entityId: rackId,
              message: `CRITICAL: Rack PDU Breaker TRIPPED on [${transform?.name || rackId}] due to prolonged power overload! All mounted servers are offline.`,
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
