import type { EntityId } from './Entity';

export interface Component {
  entityId: EntityId;
  type: string;
}

export type ComponentConstructor<T extends Component> = new (...args: any[]) => T;

export class ComponentManager {
  private components: Map<string, Map<EntityId, Component>> = new Map();

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const type = component.type;
    if (!this.components.has(type)) {
      this.components.set(type, new Map());
    }
    this.components.get(type)!.set(entityId, component);
  }

  getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
    return this.components.get(type)?.get(entityId) as T;
  }

  removeComponent(entityId: EntityId, type: string): void {
    this.components.get(type)?.delete(entityId);
  }

  getEntitiesWithComponent(type: string): EntityId[] {
    const componentMap = this.components.get(type);
    return componentMap ? Array.from(componentMap.keys()) : [];
  }
}
