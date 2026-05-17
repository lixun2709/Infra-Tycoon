import type { World } from './World'
import type { Component } from './types'

export interface SnapshotPayload {
  entities: string[]
  components: Record<string, Component[]>
  timestamp: number
}

export class ECSSnapshot {
  /**
   * Captures and serializes the complete active state of the ECS World.
   */
  public static capture(world: World): SnapshotPayload {
    const entities: string[] = []
    const components: Record<string, Component[]> = {}

    // Gather all registered entities
    const allEntities = world.getEntitiesWith([])
    allEntities.forEach(id => entities.push(id))

    // List of active component types in our ecosystem
    const componentNames = ['transform', 'thermal', 'power', 'provisioning', 'application']
    componentNames.forEach(name => {
      const map = world.getComponentMap(name)
      if (map.size > 0) {
        components[name] = Array.from(map.values())
      }
    })

    return {
      entities,
      components,
      timestamp: Date.now()
    }
  }

  /**
   * Clears the ECS World and restores state from a capture snapshot.
   */
  public static restore(world: World, snapshot: SnapshotPayload): void {
    world.clear()

    // 1. Re-register all entities
    snapshot.entities.forEach(id => {
      world.registerEntity(id)
    })

    // 2. Add all components back into index queries
    Object.entries(snapshot.components).forEach(([name, list]) => {
      list.forEach(comp => {
        world.addComponent(name, comp)
      })
    })
  }
}
