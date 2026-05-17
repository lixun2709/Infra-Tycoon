import { describe, it, expect } from 'vitest'
import { World } from '../World'
import { System } from '../System'
import { SystemManager } from '../SystemManager'
import { ECSSnapshot } from '../ECSSnapshot'
import type { TransformComponent } from '../types'

class MockSystem extends System {
  public value = 0
  private step: number
  constructor(world: World, step: number) {
    super(world)
    this.step = step
  }
  public update(dt: number): void {
    this.value += this.step * dt
  }
}

describe('SystemManager and ECSSnapshot Core Systems', () => {

  describe('SystemManager Pipelines', () => {
    it('should register and execute active systems sorted by priority', () => {
      const world = new World()
      const manager = new SystemManager()

      const s1 = new MockSystem(world, 1)
      const s2 = new MockSystem(world, 2)

      manager.registerSystem(s1, 100) // Lower priority value
      manager.registerSystem(s2, 50)  // Runs first!

      const sorted = manager.getSystemsSorted()
      expect(sorted[0]).toBe(s2)
      expect(sorted[1]).toBe(s1)

      manager.updateSystems(2.0)
      expect(s1.value).toBe(2)
      expect(s2.value).toBe(4)
    })

    it('should dynamically toggle system enabled states at runtime', () => {
      const world = new World()
      const manager = new SystemManager()

      const s1 = new MockSystem(world, 1)
      manager.registerSystem(s1, 50)

      manager.updateSystems(1.0)
      expect(s1.value).toBe(1)

      // Disable MockSystem
      manager.setSystemEnabled(MockSystem, false)
      manager.updateSystems(1.0)
      expect(s1.value).toBe(1) // Should not increment!

      // Re-enable
      manager.setSystemEnabled(MockSystem, true)
      manager.updateSystems(1.0)
      expect(s1.value).toBe(2)
    })
  })

  describe('ECSSnapshot Serialization & Replication', () => {
    it('should capture and restore complete ECS state accurately', () => {
      const world = new World()
      
      const entityId = 'node-001'
      world.registerEntity(entityId)
      
      const transform: TransformComponent = {
        entityId,
        siteId: 'site-1',
        type: 'compute'
      }
      world.addComponent('transform', transform)

      // Capture snapshot
      const snapshot = ECSSnapshot.capture(world)
      expect(snapshot.entities).toContain(entityId)
      expect(snapshot.components.transform?.[0]).toEqual(transform)

      // Mutate world
      world.clear()
      expect(world.getEntityCount()).toBe(0)

      // Restore snapshot
      ECSSnapshot.restore(world, snapshot)
      expect(world.getEntityCount()).toBe(1)
      expect(world.hasComponent('transform', entityId)).toBe(true)
      expect(world.getComponent<TransformComponent>('transform', entityId)?.siteId).toBe('site-1')
    })
  })
})
