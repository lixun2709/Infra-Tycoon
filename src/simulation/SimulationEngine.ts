import { World } from './ecs/World'
import { ThermalSystem } from './ecs/systems/ThermalSystem'
import { PowerSystem } from './ecs/systems/PowerSystem'
import { ProvisioningSystem } from './ecs/systems/ProvisioningSystem'
import { ApplicationSystem } from './ecs/systems/ApplicationSystem'
import { StorageSystem } from './ecs/systems/StorageSystem'
import { PacketSystem } from './ecs/systems/PacketSystem'
import { TelemetrySystem } from './ecs/systems/TelemetrySystem'
import { ObservabilitySystem } from './ecs/systems/ObservabilitySystem'
import { SystemManager } from './ecs/SystemManager'

/**
 * SimulationEngine
 * Orchestrates ECS systems and manages the simulation lifecycle.
 */
export class SimulationEngine {
  private world: World
  private systemManager: SystemManager
  private lastTickTime: number = 0
  private tickDurationMs: number = 0
  private systemTimings: Record<string, number> = {}

  constructor() {
    this.world = new World()
    this.systemManager = new SystemManager()

    // Register active simulation systems with strict priority execution
    this.systemManager.registerSystem(new PowerSystem(this.world), 10)
    this.systemManager.registerSystem(new ThermalSystem(this.world), 20)
    this.systemManager.registerSystem(new StorageSystem(this.world), 25)
    this.systemManager.registerSystem(new PacketSystem(this.world), 28)
    this.systemManager.registerSystem(new ProvisioningSystem(this.world), 30)
    this.systemManager.registerSystem(new ApplicationSystem(this.world), 40)
    this.systemManager.registerSystem(new TelemetrySystem(this.world), 50)
    this.systemManager.registerSystem(new ObservabilitySystem(this.world), 60)
  }

  public getWorld() {
    return this.world
  }

  public getSystemManager() {
    return this.systemManager
  }

  public update(dt: number) {
    const start = performance.now()
    
    // Execute systems dynamically in priority sequence
    this.systemTimings = this.systemManager.updateSystems(dt)
    
    this.tickDurationMs = performance.now() - start
    this.lastTickTime = Date.now()
  }

  public getTelemetry() {
    return {
      tickDurationMs: this.tickDurationMs,
      entityCount: this.world.getEntityCount(),
      lastTickTime: this.lastTickTime,
      systemTimings: this.systemTimings,
      systemProfiling: this.systemManager.getProfilingData(),
      queryTelemetry: this.world.getQueryTelemetry(),
      simStats: TelemetrySystem.simStats
    }
  }
}

// Singleton instance for global simulation management
export const simEngine = new SimulationEngine()

