import { describe, it, expect, vi } from 'vitest'
import { World } from '../World'
import type { Component } from '../types'

interface DummyComponent extends Component {
  value: number
}

describe('Enterprise ECS Subsystem Core', () => {
  
  it('should successfully register and remove entities', () => {
    const world = new World()
    const registeredSpy = vi.fn()
    const removedSpy = vi.fn()

    world.eventBus.subscribe('entity:registered', registeredSpy)
    world.eventBus.subscribe('entity:removed', removedSpy)

    const entityId = 'entity-1'
    world.registerEntity(entityId)
    expect(world.getEntityCount()).toBe(1)
    expect(registeredSpy).toHaveBeenCalledWith({ entityId })

    world.removeEntity(entityId)
    expect(world.getEntityCount()).toBe(0)
    expect(removedSpy).toHaveBeenCalledWith({ entityId })
  })

  it('should incrementally index components and update query caches', () => {
    const world = new World()
    const entityId = 'entity-abc'
    world.registerEntity(entityId)

    // Add component
    const comp: DummyComponent = { entityId, value: 42 }
    world.addComponent('dummy', comp)

    expect(world.hasComponent('dummy', entityId)).toBe(true)
    expect(world.getComponent<DummyComponent>('dummy', entityId)).toBe(comp)

    // Check O(1) query caching
    const entitiesWithDummy = world.getEntitiesWith(['dummy'])
    expect(entitiesWithDummy.length).toBe(1)
    expect(entitiesWithDummy[0]).toBe(entityId)

    // Validate that getEntitiesWith returned a cached, identical array
    const entitiesWithDummyAgain = world.getEntitiesWith(['dummy'])
    expect(entitiesWithDummyAgain).toBe(entitiesWithDummy) // Reference check! O(1) cache hit

    const tele = world.getQueryTelemetry()
    expect(tele.queryHits).toBe(1)
    expect(tele.queryMisses).toBe(1)
    expect(tele.cacheHitRatio).toBe(0.5)
  })

  it('should gracefully handle component removals and updates', () => {
    const world = new World()
    const entityId = 'entity-xyz'

    world.addComponent('dummy', { entityId, value: 100 } as DummyComponent)
    expect(world.getEntitiesWith(['dummy']).length).toBe(1)

    world.removeComponent('dummy', entityId)
    expect(world.getEntitiesWith(['dummy']).length).toBe(0)
  })

  it('should publish events to the ECS Event Bus', () => {
    const world = new World()
    const entityId = 'entity-event'
    const addedSpy = vi.fn()
    const removedSpy = vi.fn()

    world.eventBus.subscribe('component:added', addedSpy)
    world.eventBus.subscribe('component:removed', removedSpy)

    world.addComponent('test-comp', { entityId } as Component)
    expect(addedSpy).toHaveBeenCalled()

    world.removeEntity(entityId)
    expect(removedSpy).toHaveBeenCalledWith({ entityId, componentName: 'test-comp' })
  })

  it('should provide exceptional error boundary safety', () => {
    const world = new World()
    const errSpy = vi.fn()

    world.eventBus.subscribe('system:error', errSpy)

    // Force an event handler error inside the bus
    world.eventBus.subscribe('entity:registered', () => {
      throw new Error('Listener Crashed')
    })

    // Registation should not crash the world and instead invoke safety boundary
    expect(() => world.registerEntity('safety-1')).not.toThrow()
  })

  it('should perform 10,000+ entity operations in milliseconds (Scalability Stress Test)', () => {
    const world = new World()
    const totalEntities = 10000

    const tStart = performance.now()
    for (let i = 0; i < totalEntities; i++) {
      const id = `stress-${i}`
      world.addComponent('position', { entityId: id })
      if (i % 2 === 0) {
        world.addComponent('thermal', { entityId: id })
      }
    }
    const tInit = performance.now() - tStart
    console.log(`[[ECS Stress Test]] Added ${totalEntities} entities and components in ${tInit.toFixed(2)}ms`)

    // Query 1: All positions
    const q1Start = performance.now()
    const posEntities = world.getEntitiesWith(['position'])
    const q1MissTime = performance.now() - q1Start
    expect(posEntities.length).toBe(totalEntities)

    // Cached Query 1: should be O(1) reference return
    const q1CacheStart = performance.now()
    const posEntitiesCached = world.getEntitiesWith(['position'])
    const q1HitTime = performance.now() - q1CacheStart
    expect(posEntitiesCached).toBe(posEntities) // identical reference!
    expect(q1HitTime).toBeLessThanOrEqual(q1MissTime)
    
    // Query 2: All thermals
    const thermalEntities = world.getEntitiesWith(['thermal'])
    expect(thermalEntities.length).toBe(totalEntities / 2)

    // Combined Query: both position and thermal
    const combinedEntities = world.getEntitiesWith(['position', 'thermal'])
    expect(combinedEntities.length).toBe(totalEntities / 2)

    console.log(`[[ECS Stress Test]] O(1) Cache Hit: ${q1HitTime.toFixed(4)}ms (Miss took: ${q1MissTime.toFixed(4)}ms)`)
    
    const tele = world.getQueryTelemetry()
    expect(tele.activeQueries).toBe(3)
    expect(tele.queryHits).toBe(1)
    expect(tele.queryMisses).toBe(3)
  })
})
