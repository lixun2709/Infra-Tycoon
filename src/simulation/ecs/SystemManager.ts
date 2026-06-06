/* eslint-disable @typescript-eslint/no-explicit-any */
import type { System } from './System'

export interface SystemMetadata {
  priority: number
  enabled: boolean
  lastDurationMs: number
}

export class SystemManager {
  private systems: Map<System, SystemMetadata> = new Map()

  /**
   * Registers a new ECS system with priority order (lower value runs first).
   */
  public registerSystem(system: System, priority = 100): void {
    this.systems.set(system, { priority, enabled: true, lastDurationMs: 0 })
  }

  /**
   * Deregisters an ECS system.
   */
  public deregisterSystem(system: System): void {
    this.systems.delete(system)
  }

  /**
   * Retrieves a registered ECS system by its class constructor.
   */

  public getSystem<T extends System>(systemClass: new (...args: any[]) => T): T | undefined {
    let found: T | undefined
    this.systems.forEach((_, system) => {
      if (system instanceof systemClass) {
        found = system as T
      }
    })
    return found
  }

  /**
   * Dynamically enables/disables a registered system.
   */

  public setSystemEnabled(systemClass: new (...args: any[]) => System, enabled: boolean): void {
    this.systems.forEach((meta, system) => {
      if (system instanceof systemClass) {
        meta.enabled = enabled
      }
    })
  }

  /**
   * Returns registered systems sorted by priority.
   */
  public getSystemsSorted(): System[] {
    return Array.from(this.systems.entries())
      .filter(([_, meta]) => meta.enabled)
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([system]) => system)
  }

  /**
   * Updates all active systems in priority sequence and logs elapsed durations.
   */
  public updateSystems(dt: number): Record<string, number> {
    const timings: Record<string, number> = {}
    const sorted = this.getSystemsSorted()
    
    sorted.forEach(system => {
      const start = performance.now()
      system.update(dt)
      const elapsed = performance.now() - start
      
      const meta = this.systems.get(system)
      if (meta) {
        meta.lastDurationMs = elapsed
      }
      timings[system.constructor.name] = elapsed
    })
    
    return timings
  }

  /**
   * Retrieves fine-grained timing and status profiles for telemetry layers.
   */
  public getProfilingData(): Record<string, { enabled: boolean; priority: number; durationMs: number }> {
    const data: Record<string, { enabled: boolean; priority: number; durationMs: number }> = {}
    this.systems.forEach((meta, system) => {
      data[system.constructor.name] = {
        enabled: meta.enabled,
        priority: meta.priority,
        durationMs: meta.lastDurationMs
      }
    })
    return data
  }
}

