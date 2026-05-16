import type { Entity, Component, ComponentMap } from './types'

/**
 * ECS World
 * Manages entities and component storage.
 */
export class World {
  private entities: Set<Entity> = new Set()
  private components: Map<string, ComponentMap<any>> = new Map()

  public registerEntity(id: Entity) {
    this.entities.add(id)
  }

  public removeEntity(id: Entity) {
    this.entities.delete(id)
    this.components.forEach(map => map.delete(id))
  }

  public addComponent<T extends Component>(componentName: string, component: T) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map())
    }
    this.components.get(componentName)!.set(component.entityId, component)
  }

  public getComponent<T extends Component>(componentName: string, entityId: Entity): T | undefined {
    return this.components.get(componentName)?.get(entityId)
  }

  public getComponentMap<T extends Component>(componentName: string): ComponentMap<T> {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map())
    }
    return this.components.get(componentName) as ComponentMap<T>
  }

  public getEntitiesWith(componentNames: string[]): Entity[] {
    if (componentNames.length === 0) return Array.from(this.entities)
    
    // Start with entities in the first component map
    const firstMap = this.components.get(componentNames[0])
    if (!firstMap) return []
    
    let result = Array.from(firstMap.keys())
    
    // Intersect with remaining component maps
    for (let i = 1; i < componentNames.length; i++) {
      const map = this.components.get(componentNames[i])
      if (!map) return []
      result = result.filter(id => map.has(id))
    }
    
    return result
  }

  public clear() {
    this.entities.clear()
    this.components.clear()
  }
}
