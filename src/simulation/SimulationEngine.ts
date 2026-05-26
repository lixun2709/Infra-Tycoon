import { World } from './ecs/World'
import { ThermalSystem } from './ecs/systems/ThermalSystem'
import { PowerSystem } from './ecs/systems/PowerSystem'
import { RackSystem } from './ecs/systems/RackSystem'
import { ProvisioningSystem } from './ecs/systems/ProvisioningSystem'
import { ApplicationSystem } from './ecs/systems/ApplicationSystem'
import { StorageSystem } from './ecs/systems/StorageSystem'
import { PacketSystem } from './ecs/systems/PacketSystem'
import { TelemetrySystem } from './ecs/systems/TelemetrySystem'
import { BackupSystem } from './ecs/systems/BackupSystem'
import { SecuritySystem } from './ecs/systems/SecuritySystem'
import { ObservabilitySystem } from './ecs/systems/ObservabilitySystem'
import { ObservabilityTracer } from './observability/ObservabilityTracer'
import { SlaSystem } from './ecs/systems/SlaSystem'
import { HypervisorSystem } from './ecs/systems/HypervisorSystem'
import { KubernetesSystem } from './ecs/systems/KubernetesSystem'
import { TicketingSystem } from './ecs/systems/TicketingSystem'
import { IncidentSystem } from './ecs/systems/IncidentSystem'
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
    this.systemManager.registerSystem(new HypervisorSystem(this.world), 12)
    this.systemManager.registerSystem(new SlaSystem(this.world), 13)
    this.systemManager.registerSystem(new TicketingSystem(), 14)
    this.systemManager.registerSystem(new IncidentSystem(), 15)
    this.systemManager.registerSystem(new RackSystem(this.world), 15)
    this.systemManager.registerSystem(new ThermalSystem(this.world), 20)
    this.systemManager.registerSystem(new StorageSystem(this.world), 25)
    this.systemManager.registerSystem(new PacketSystem(this.world), 28)
    this.systemManager.registerSystem(new ProvisioningSystem(this.world), 30)
    this.systemManager.registerSystem(new KubernetesSystem(this.world), 31) // K8s evaluates node health and schedules pods
    this.systemManager.registerSystem(new ApplicationSystem(this.world), 15) // Apps
    
    const telemetrySys = new TelemetrySystem(this.world)
    this.systemManager.registerSystem(telemetrySys, 20) // Telemetry stats

    this.systemManager.registerSystem(new SecuritySystem(this.world), 25) // Security before network/packet
    this.systemManager.registerSystem(new ObservabilitySystem(this.world, telemetrySys), 30) // Alerts based on Telemetry
    this.systemManager.registerSystem(new BackupSystem(this.world), 32) // Backup evaluates before SLA
    this.systemManager.registerSystem(new SlaSystem(this.world), 35) // SLA evaluates after all apps and telemetry
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
      simStats: this.systemManager.getSystem(TelemetrySystem)?.simStats,
      spans: ObservabilityTracer.getSpans()
    }
  }
}

// Singleton instance for global simulation management
export const simEngine = new SimulationEngine()

