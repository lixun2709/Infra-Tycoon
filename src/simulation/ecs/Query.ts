import type { Entity } from './types'
import type { World } from './World'

/**
 * ECS Query
 * Tracks a cached subset of entities that possess a specific collection of components.
 * Yields O(1) retrieval times for systems during updates.
 */
export class Query {
  public readonly requiredComponents: readonly string[]
  private entities: Set<Entity> = new Set()
  private cachedArray: Entity[] | null = null

  constructor(components: string[]) {
    // Keep them sorted for consistent query keys if hashed
    this.requiredComponents = Object.freeze([...components].sort())
  }

  /**
   * Evaluates if an entity matches this query's requirements.
   */
  public matches(entityId: Entity, world: World): boolean {
    for (const comp of this.requiredComponents) {
      if (!world.hasComponent(comp, entityId)) {
        return false
      }
    }
    return true
  }

  /**
   * Incrementally updates the query cache for a given entity.
   * If it matches, adds it to the cached set. If not, removes it.
   */
  public evaluate(entityId: Entity, world: World): boolean {
    const isMatch = this.matches(entityId, world)
    const exists = this.entities.has(entityId)

    if (isMatch && !exists) {
      this.entities.add(entityId)
      this.cachedArray = null // Invalidate array cache
      return true
    } else if (!isMatch && exists) {
      this.entities.delete(entityId)
      this.cachedArray = null // Invalidate array cache
      return true
    }

    return false
  }

  /**
   * Direct removal of an entity (e.g. entity was deleted).
   */
  public remove(entityId: Entity): boolean {
    if (this.entities.has(entityId)) {
      this.entities.delete(entityId)
      this.cachedArray = null // Invalidate array cache
      return true
    }
    return false
  }

  /**
   * Returns the cached array of matching entities.
   * Allocates a new array ONLY when the query matches have changed.
   */
  public getEntities(): readonly Entity[] {
    if (this.cachedArray === null) {
      this.cachedArray = Array.from(this.entities)
    }
    return this.cachedArray
  }

  /**
   * Clears the query cache.
   */
  public clear(): void {
    this.entities.clear()
    this.cachedArray = null
  }

  /**
   * Gets the number of matching entities in the cache.
   */
  public get size(): number {
    return this.entities.size
  }
}
