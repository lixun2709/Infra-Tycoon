import { System } from '../System'
import type { PowerComponent, TransformComponent } from '../types'

/**
 * PowerSystem
 * ECS implementation of power distribution and load balancing.
 */
export class PowerSystem extends System {
  public update(_dt: number) {
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const entities = this.world.getEntitiesWith(['power', 'transform'])

    // 1. Calculate Rack Power Loads in O(N) single-pass summation
    const rackLoads = new Map<string, number>()
    const racks: string[] = []

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        racks.push(id)
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

    racks.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      if (rackPower) {
        const totalLoad = rackLoads.get(rackId) ?? 0
        rackPower.load = totalLoad / 1000 // Convert to kW
      }
    })
  }
}
