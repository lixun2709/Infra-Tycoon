import { World } from './ecs/World'
import { System } from './ecs/System'
import { ThermalSystem } from './ecs/systems/ThermalSystem'
import { PowerSystem } from './ecs/systems/PowerSystem'
import { ProvisioningSystem } from './ecs/systems/ProvisioningSystem'
import { ApplicationSystem } from './ecs/systems/ApplicationSystem'

/**
 * SimulationEngine
 * Orchestrates ECS systems and manages the simulation lifecycle.
 */
export class SimulationEngine {
  private world: World
  private systems: System[] = []
  private lastTickTime: number = 0
  private tickDurationMs: number = 0

  constructor() {
    this.world = new World()
    this.systems = [
      new ThermalSystem(this.world),
      new PowerSystem(this.world),
      new ProvisioningSystem(this.world),
      new ApplicationSystem(this.world)
    ]
  }

  public getWorld() {
    return this.world
  }

  public update(dt: number) {
    const start = performance.now()
    
    this.systems.forEach(system => {
      system.update(dt)
    })
    
    this.tickDurationMs = performance.now() - start
    this.lastTickTime = Date.now()
  }

  public getTelemetry() {
    return {
      tickDurationMs: this.tickDurationMs,
      entityCount: this.world.getEntitiesWith([]).length,
      lastTickTime: this.lastTickTime
    }
  }
}

// Singleton instance for global simulation management
export const simEngine = new SimulationEngine()
