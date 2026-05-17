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
  private systems: System[]
  private lastTickTime: number = 0
  private tickDurationMs: number = 0
  private systemTimings: Record<string, number> = {}

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
    this.systemTimings = {}
    
    this.systems.forEach(system => {
      const sysStart = performance.now()
      system.update(dt)
      this.systemTimings[system.constructor.name] = performance.now() - sysStart
    })
    
    this.tickDurationMs = performance.now() - start
    this.lastTickTime = Date.now()
  }

  public getTelemetry() {
    return {
      tickDurationMs: this.tickDurationMs,
      entityCount: this.world.getEntityCount(),
      lastTickTime: this.lastTickTime,
      systemTimings: this.systemTimings,
      queryTelemetry: this.world.getQueryTelemetry()
    }
  }
}

// Singleton instance for global simulation management
export const simEngine = new SimulationEngine()
