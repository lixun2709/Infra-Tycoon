import type { EntityId } from './Entity';

export interface Component<T = unknown> {
  entityId: EntityId;
  type: string;
  data: T;
}

export type ComponentConstructor<T extends Component> = new (...args: unknown[]) => T;

export class ComponentManager {
  private components: Map<string, Map<EntityId, Component>> = new Map();

  addComponent(entityId: EntityId, component: Component): void {
    const type = component.type;
    if (!this.components.has(type)) {
      this.components.set(type, new Map());
    }
    this.components.get(type)!.set(entityId, component);
  }

  getComponent<T>(entityId: EntityId, type: string): Component<T> | undefined {
    return this.components.get(type)?.get(entityId) as Component<T> | undefined;
  }

  removeComponent(entityId: EntityId, type: string): void {
    this.components.get(type)?.delete(entityId);
  }

  getEntitiesWithComponent(type: string): EntityId[] {
    const componentMap = this.components.get(type);
    return componentMap ? Array.from(componentMap.keys()) : [];
  }
}
