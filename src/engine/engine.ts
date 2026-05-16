import { EntityManager } from './ecs/Entity';
import { ComponentManager } from './ecs/Component';
import { SystemManager } from './ecs/System';
import { SimulationLoop } from './simulation/SimulationLoop';
import { globalEventBus } from './events/EventBus';

export class Engine {
  public entityManager: EntityManager;
  public componentManager: ComponentManager;
  public systemManager: SystemManager;
  public simulationLoop: SimulationLoop;
  public eventBus = globalEventBus;

  constructor() {
    this.entityManager = new EntityManager();
    this.componentManager = new ComponentManager();
    this.systemManager = new SystemManager(this.entityManager, this.componentManager);
    this.simulationLoop = new SimulationLoop((dt, total) => this.update(dt, total));
  }

  private update(dt: number, total: number) {
    this.systemManager.update(dt, total);
    this.eventBus.publish('tick', { dt, total });
  }

  start() {
    this.simulationLoop.start();
  }

  stop() {
    this.simulationLoop.stop();
  }
}

export const engine = new Engine();
