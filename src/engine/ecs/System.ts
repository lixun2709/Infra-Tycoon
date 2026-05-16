import { EntityManager } from './Entity';
import { ComponentManager } from './Component';

export abstract class System {
  protected entityManager: EntityManager;
  protected componentManager: ComponentManager;

  constructor(
    entityManager: EntityManager,
    componentManager: ComponentManager
  ) {
    this.entityManager = entityManager;
    this.componentManager = componentManager;
  }

  abstract update(dt: number, totalTime: number): void;
}

export class SystemManager {
  private systems: System[] = [];
  private entityManager: EntityManager;
  private componentManager: ComponentManager;

  constructor(
    entityManager: EntityManager,
    componentManager: ComponentManager
  ) {
    this.entityManager = entityManager;
    this.componentManager = componentManager;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(dt: number, totalTime: number): void {
    for (const system of this.systems) {
      system.update(dt, totalTime);
    }
  }
}
