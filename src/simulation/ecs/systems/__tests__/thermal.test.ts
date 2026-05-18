import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { ThermalSystem } from '../ThermalSystem'
import type { 
  ThermalComponent, 
  PowerComponent, 
  TransformComponent 
} from '../../types'

describe('Thermodynamic Simulation Subsystem Core', () => {
  it('should dynamically calculate zone-localized ambient temperature increase without CRAC cooling', () => {
    const world = new World()
    const system = new ThermalSystem(world)

    const siteId = 'site-austin'
    const nodeId = 'srv-gpu-01'

    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      type: 'compute',
      siteId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 25.0,
      isThrottled: false,
      fanSpeedPercent: 20.0,
      btuOutput: 4000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // High wattage GPU load (1200W, load=1.0)
    world.addComponent('power', {
      entityId: nodeId,
      wattage: 1200,
      load: 1.0,
      isPowered: true,
      efficiency: 0.8
    } as PowerComponent)

    // Run 10 ticks of 1.0 second each
    for (let i = 0; i < 10; i++) {
      system.update(1.0)
    }

    const ambient = ThermalSystem.siteAmbientTemps.get(siteId)
    expect(ambient).toBeDefined()
    expect(ambient).toBeGreaterThan(22.0) // Room must have warmed up!
  })

  it('should dynamically ramp up active server fan speeds to cool silicon under high heat loads', () => {
    const world = new World()
    const system = new ThermalSystem(world)

    const siteId = 'site-austin'
    const nodeId = 'srv-cpu-01'

    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      type: 'compute',
      siteId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    // Server starts hot (55°C)
    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 55.0,
      isThrottled: false,
      fanSpeedPercent: 20.0,
      btuOutput: 1000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 300,
      load: 0.5,
      isPowered: true,
      efficiency: 0.85
    } as PowerComponent)

    // Run 2 ticks to trigger fan speed spin-up calculations
    system.update(1.0)
    system.update(1.0)

    const thermal = world.getComponent<ThermalComponent>('thermal', nodeId)!
    expect(thermal.fanSpeedPercent).toBeGreaterThan(20.0) // Fans must have accelerated!
  })

  it('should automatically trigger high-temperature silicon safeguards shutdown at critical limit (>80°C)', () => {
    const world = new World()
    const system = new ThermalSystem(world)
    // Mock the alert publish event
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const siteId = 'site-austin'
    const nodeId = 'srv-overheat-01'

    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      type: 'compute',
      siteId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    // Server is critical (82°C)
    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 82.0,
      isThrottled: true,
      fanSpeedPercent: 100.0,
      btuOutput: 1000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 300,
      load: 0.5,
      isPowered: true,
      efficiency: 0.8
    } as PowerComponent)

    system.update(1.0)

    const power = world.getComponent<PowerComponent>('power', nodeId)!
    expect(power.isPowered).toBe(false) // Power must be automatically cut off!
    expect(alertSpy).toHaveBeenCalled() // Alert event must be fired!
  })

  it('should reduce site ambient temperatures when active CRAC cooling units are deployed and running', () => {
    const world = new World()
    const system = new ThermalSystem(world)

    const siteId = 'site-austin'
    const serverId = 'srv-gpu-02'
    const cracId = 'crac-unit-01'

    // Set high initial room temperature (45.0°C)
    ThermalSystem.siteAmbientTemps.set(siteId, 45.0)

    world.registerEntity(serverId)
    world.registerEntity(cracId)

    // Add Compute Node
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      siteId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: serverId,
      temperature: 30.0,
      isThrottled: false,
      fanSpeedPercent: 20.0,
      btuOutput: 1000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 300,
      load: 0.5,
      isPowered: true,
      efficiency: 0.8
    } as PowerComponent)

    // Add high-capacity In-Row CRAC cooling node (btuOutput is -50000)
    world.addComponent('transform', {
      entityId: cracId,
      type: 'cooling',
      siteId,
      position: { x: 1, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: cracId,
      temperature: 20.0,
      isThrottled: false,
      fanSpeedPercent: 100.0,
      btuOutput: -50000.0, // Cooling capacity
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: cracId,
      wattage: 5000,
      load: 1.0,
      isPowered: true,
      efficiency: 0.95
    } as PowerComponent)

    // Run ticks
    for (let i = 0; i < 5; i++) {
      system.update(1.0)
    }

    const ambient = ThermalSystem.siteAmbientTemps.get(siteId)!
    expect(ambient).toBeLessThan(45.0) // Room ambient must have successfully cooled down!
  })
})
