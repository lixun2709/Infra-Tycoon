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
          if (rack.status === 'power_overload') {
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
