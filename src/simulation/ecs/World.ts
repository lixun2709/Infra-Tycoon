import type { Entity, Component, ComponentMap } from './types'
import { ECSEventBus } from './EventBus'
import { Query } from './Query'

/**
 * ECS World
 * Modern, enterprise-grade coordinator of Entities, Components, and cached Queries.
 */
export class World {
  private entities: Set<Entity> = new Set()
  private components: Map<string, ComponentMap<Component>> = new Map()
  
  // High-performance Query cache
  private queries: Map<string, Query> = new Map()
  
  // Local thread-safe ECS Event Bus
  public readonly eventBus: ECSEventBus = new ECSEventBus()

  // Telemetry metrics
  private queryHits = 0
  private queryMisses = 0

  /**
   * Registers a new unique Entity into the World.
   */
  public registerEntity(id: Entity): void {
    if (this.entities.has(id)) {
      console.warn(`[[ECS World]] Entity with ID ${id} already registered. Skipping.`)
      return
    }

    try {
      this.entities.add(id)
      this.eventBus.publish('entity:registered', { entityId: id })
    } catch (err) {
      console.error(`[[ECS World]] Failed to register entity ${id}:`, err)
      this.eventBus.publish('system:error', {
        systemName: 'World',
        error: err instanceof Error ? err : new Error(String(err))
      })
    }
  }

  /**
   * Removes an Entity and cleans up all its components from query indexes.
   */
  public removeEntity(id: Entity): void {
    if (!this.entities.has(id)) return

    try {
      // 1. Remove from all active query caches
      this.queries.forEach(query => {
        query.remove(id)
      })

      // 2. Remove all associated components
      this.components.forEach((map, componentName) => {
        if (map.has(id)) {
          map.delete(id)
          this.eventBus.publish('component:removed', { entityId: id, componentName })
        }
      })

      // 3. Remove from main entity index
      this.entities.delete(id)
      this.eventBus.publish('entity:removed', { entityId: id })
    } catch (err) {
      console.error(`[[ECS World]] Error during entity ${id} teardown:`, err)
      this.eventBus.publish('system:error', {
        systemName: 'World',
        error: err instanceof Error ? err : new Error(String(err))
      })
    }
  }

  /**
   * Adds a Component to an Entity and incrementally updates query indexes.
   */
  public addComponent<T extends Component>(componentName: string, component: T): void {
    const entityId = component.entityId

    if (!this.entities.has(entityId)) {
      // Auto-register unregistered entities to match original behavior resiliently
      this.registerEntity(entityId)
    }

    try {
      if (!this.components.has(componentName)) {
        this.components.set(componentName, new Map())
      }
      
      this.components.get(componentName)!.set(entityId, component)

      // Incrementally evaluate active queries for this entity
      this.queries.forEach(query => {
        if (query.requiredComponents.includes(componentName)) {
          query.evaluate(entityId, this)
        }
      })

      this.eventBus.publish('component:added', { entityId, componentName, component })
    } catch (err) {
      console.error(`[[ECS World]] Failed to add component ${componentName} to ${entityId}:`, err)
      this.eventBus.publish('system:error', {
        systemName: 'World',
        error: err instanceof Error ? err : new Error(String(err))
      })
    }
  }

  /**
   * Removes a Component from an Entity and updates query caches.
   */
  public removeComponent(componentName: string, entityId: Entity): void {
    const map = this.components.get(componentName)
    if (!map || !map.has(entityId)) return

    try {
      map.delete(entityId)

      // Incrementally evaluate active queries for this entity
      this.queries.forEach(query => {
        if (query.requiredComponents.includes(componentName)) {
          query.evaluate(entityId, this)
        }
      })

      this.eventBus.publish('component:removed', { entityId, componentName })
    } catch (err) {
      console.error(`[[ECS World]] Failed to remove component ${componentName} from ${entityId}:`, err)
      this.eventBus.publish('system:error', {
        systemName: 'World',
        error: err instanceof Error ? err : new Error(String(err))
      })
    }
  }

  /**
   * Checks if an Entity has a specific component.
   */
  public hasComponent(componentName: string, entityId: Entity): boolean {
    return !!this.components.get(componentName)?.has(entityId)
  }

  /**
   * Gets a specific Component for an Entity in O(1) time.
   */
  public getComponent<T extends Component>(componentName: string, entityId: Entity): T | undefined {
    return this.components.get(componentName)?.get(entityId) as T | undefined
  }

  /**
   * Returns a ComponentMap for direct iteration.
   */
  public getComponentMap<T extends Component>(componentName: string): ComponentMap<T> {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map())
    }
    return this.components.get(componentName) as ComponentMap<T>
  }

  /**
   * High-Performance, O(1) cached query resolver.
   * Maintains complete backward compatibility with the original getEntitiesWith API.
   */
  public getEntitiesWith(componentNames: string[]): readonly Entity[] {
    if (componentNames.length === 0) {
      return Array.from(this.entities)
    }

    // Generate unique index key for the query
    const sortedNames = [...componentNames].sort()
    const queryKey = sortedNames.join(',')

    let query = this.queries.get(queryKey)
    if (query) {
      this.queryHits++
    } else {
      this.queryMisses++
      
      // Cache miss: construct new Query
      query = new Query(sortedNames)
      
      // Backfill the query cache with all currently matching entities
      this.entities.forEach(entityId => {
        query!.evaluate(entityId, this)
      })

      this.queries.set(queryKey, query)
    }

    return query.getEntities()
  }

  /**
   * Completely clears the ECS World.
   */
  public clear(): void {
    this.entities.clear()
    this.components.clear()
    this.queries.forEach(q => q.clear())
    this.queries.clear()
    this.eventBus.clear()
    this.queryHits = 0
    this.queryMisses = 0
  }

  /**
   * Gets total entity count in the world.
   */
  public getEntityCount(): number {
    return this.entities.size
  }

  /**
   * Returns complete structural and performance stats for telemetry systems.
   */
  public getComponentStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    this.components.forEach((map, name) => {
      stats[name] = map.size
    })
    return stats
  }

  /**
   * ECS-specific query telemetry.
   */
  public getQueryTelemetry() {
    return {
      activeQueries: this.queries.size,
      queryHits: this.queryHits,
      queryMisses: this.queryMisses,
      cacheHitRatio: this.queryHits + this.queryMisses > 0 
        ? this.queryHits / (this.queryHits + this.queryMisses) 
        : 0
    }
  }
}
