export type EntityId = string;

export interface Entity {
  id: EntityId;
  name: string;
  type: string;
}

export class EntityManager {
  private entities: Map<EntityId, Entity> = new Map();

  createEntity(name: string, type: string): Entity {
    const id = crypto.randomUUID();
    const entity = { id, name, type };
    this.entities.set(id, entity);
    return entity;
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
}
