import { System } from '../System'
import type { ProvisioningComponent, PowerComponent } from '../types'

/**
 * ProvisioningSystem
 * ECS implementation of hardware boot sequences and lifecycle state.
 */
export class ProvisioningSystem extends System {
  public update(dt: number) {
    const provisioningMap = this.world.getComponentMap<ProvisioningComponent>('provisioning')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const entities = this.world.getEntitiesWith(['provisioning', 'power'])

    entities.forEach(id => {
      const prov = provisioningMap.get(id)!
      const power = powerMap.get(id)!

      // Simple boot progress simulation if system is "booting"
      // Note: Full state machine still lives in Store for UI reactivity, 
      // but ECS handles the deterministic progress.
      
      if (power.isPowered && prov.bootProgress < 100) {
        // Deterministic boot increment
        prov.bootProgress = Math.min(100, prov.bootProgress + (5 * dt))
      }
    })
  }
}
