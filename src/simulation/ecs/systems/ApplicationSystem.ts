import { System } from '../System'
import type { ApplicationComponent, PowerComponent } from '../types'

/**
 * ApplicationSystem
 * ECS implementation of application deployment lifecycle.
 */
export class ApplicationSystem extends System {
  public update(dt: number) {
    const appMap = this.world.getComponentMap<ApplicationComponent>('application')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const entities = this.world.getEntitiesWith(['application'])

    entities.forEach(id => {
      const app = appMap.get(id)!
      const power = powerMap.get(id)

      // Only progress if node is powered on and running
      if (power && power.isPowered && app.status === 'deploying') {
        app.progress = Math.min(100, app.progress + (10 * dt))
        if (app.progress >= 100) {
          app.status = 'running'
        }
      }
    })
  }
}
