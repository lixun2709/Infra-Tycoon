import { System } from '../System'
import type { RackComponent, PowerComponent, TransformComponent } from '../types'
import { ObservabilitySystem } from './ObservabilitySystem'

/**
 * RackSystem
 * ECS System governing physical rack configurations, slot occupancy maps, 
 * dynamic PDU capacity upgrades, and deterministic power overload state evaluations.
 */
export class RackSystem extends System {
  public update(_dt: number): void {
    const rackMap = this.world.getComponentMap<RackComponent>('rack')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    // 1. Compute dynamic slot occupancy grid and check for mounting collisions
    rackMap.forEach((rack, rackId) => {
      // Automatically scale power limit if rack has high density PDU upgrade
      rack.maxPowerKW = rack.hasHighDensityPDU ? 15.0 : 5.0

      // Reset slot occupancy grid to all false (size 43 representing slots 1 to 42, 1-indexed)
      const occupancy = new Array(43).fill(false)
      rack.slotOccupancy = occupancy

      const checkedCollisionSlots = new Set<number>()

      transformMap.forEach((childTransform) => {
        if (childTransform.parentRackId === rackId && childTransform.type !== 'rack' && childTransform.type !== 'cooling') {
          const slot = childTransform.slotIndex
          const height = childTransform.uHeight || 1

          if (slot != null && slot >= 1 && slot <= 42) {
            for (let u = slot; u < slot + height; u++) {
              if (u <= 42) {
                if (occupancy[u]) {
                  // Collision detected: Slot is occupied by multiple compute nodes!
                  if (!checkedCollisionSlots.has(u)) {
                    checkedCollisionSlots.add(u)
                    ObservabilitySystem.pushFiredAlert({
                      severity: 'warning',
                      message: `[RACK SLOT COLLISION] Server Rack [${transformMap.get(rackId)?.name || rackId}] has slot booking conflict at Slot U${u}!`,
                      nodeId: rackId
                    })
                  }
                }
                occupancy[u] = true
              }
            }
          }
        }
      })
    })

    // 2. Perform breaker overload checks and dynamic load updates
    rackMap.forEach((rack, id) => {
      const power = powerMap.get(id)
      const transform = transformMap.get(id)
      
      if (power) {
        const load = power.load || 0.0 // computed in kW by PowerSystem
        const maxLimit = rack.maxPowerKW

        if (load > maxLimit) {
          if (rack.status === 'online') {
            rack.status = 'power_overload'
            ObservabilitySystem.pushFiredAlert({
              severity: 'critical',
              message: `[RACK OVERLOAD] Server Rack [${transform?.name || id}] has exceeded its power limit! (Load: ${load.toFixed(2)} kW / Max: ${maxLimit.toFixed(2)} kW)`,
              nodeId: id
            })
          }
        } else {
          // Recovery alert only if load returns to normal AND breaker is not tripped
          if (rack.status === 'power_overload' && !power.breakerTripped) {
            rack.status = 'online'
            ObservabilitySystem.pushFiredAlert({
              severity: 'info',
              message: `[RACK RECOVERY] Server Rack [${transform?.name || id}] power load recovered to normal levels. (Load: ${load.toFixed(2)} kW / Max: ${maxLimit.toFixed(2)} kW)`,
              nodeId: id
            })
          }
        }
        
        rack.currentPowerKW = load
      }
    })
  }
}
