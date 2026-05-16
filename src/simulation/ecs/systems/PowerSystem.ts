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

    // 1. Calculate Rack Power Loads
    const racks = entities.filter(id => transformMap.get(id)?.type === 'rack')
    
    racks.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      const children = entities.filter(id => transformMap.get(id)?.parentRackId === rackId)
      
      let totalLoad = 0
      children.forEach(childId => {
        const childPower = powerMap.get(childId)!
        if (childPower.isPowered) {
          totalLoad += childPower.wattage
        }
      })

      rackPower.load = totalLoad / 1000 // Convert to KW
    })
  }
}
