import { describe, it, expect, beforeEach } from 'vitest'
import { World } from '../../World'
import { ThermalSystem } from '../ThermalSystem'
import { ObservabilitySystem } from '../ObservabilitySystem'
import type { 
  ThermalComponent, 
  PowerComponent, 
  TransformComponent
} from '../../types'

describe('Cooling Systems & Thermodynamics ECS Tests', () => {
  let world: World
  let thermalSystem: ThermalSystem

  beforeEach(() => {
    world = new World()
    thermalSystem = new ThermalSystem(world)
    ThermalSystem.siteAmbientTemps.clear()
    ObservabilitySystem.clear()
  })

  it('should dynamically update localized rack micro-climate based on server heat generation', () => {
    const rackId = 'rack-1'
    const serverId = 'server-1'
    const siteId = 'site-1'

    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      siteId
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: rackId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 0,
      btuOutput: 0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      siteId
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 5000, // Large 5 kW compute workload
      load: 1.0,
      isPowered: true,
      efficiency: 0.8
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: serverId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 20.0,
      btuOutput: 0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // Run ticks
    thermalSystem.update(1.0)

    const rackThermal = world.getComponent<ThermalComponent>('thermal', rackId)!
    // Server generates significant heat, raising the rack's micro-climate temp above ambient 22°C
    expect(rackThermal.temperature).toBeGreaterThan(22.0)
  })

  it('should neutralize rack temperature when an active In-Row CRAC unit is deployed in the rack', () => {
    const rackId = 'rack-2'
    const serverId = 'server-2'
    const cracId = 'crac-2'
    const siteId = 'site-2'

    world.registerEntity(rackId)
    world.registerEntity(serverId)
    world.registerEntity(cracId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      siteId
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: rackId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 0,
      btuOutput: 0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // High wattage compute server generating heat
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      siteId
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 5000,
      load: 1.0,
      isPowered: true,
      efficiency: 0.8
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: serverId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 20.0,
      btuOutput: 0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // In-Row CRAC unit inside the SAME rack
    world.addComponent('transform', {
      entityId: cracId,
      type: 'cooling',
      parentRackId: rackId,
      siteId
    } as TransformComponent)

    world.addComponent('power', {
      entityId: cracId,
      wattage: 1000,
      load: 1.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: cracId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 100.0,
      btuOutput: -50000, // Dynamic high BTU cooling capacity
      lastUpdate: Date.now()
    } as ThermalComponent)

    // Run ticks
    thermalSystem.update(1.0)

    const rackThermal = world.getComponent<ThermalComponent>('thermal', rackId)!
    // Cooling BTU (-50000) overrides server heat load, resulting in a chilled rack environment
    expect(rackThermal.temperature).toBeLessThan(22.0)
  })

  it('should throttle cooling unit efficiency to 50% when room ambient temperature exceeds 50°C', () => {
    const cracId = 'crac-3'
    const siteId = 'site-3'

    world.registerEntity(cracId)

    // Set ambient room temperature to 52°C
    ThermalSystem.siteAmbientTemps.set(siteId, 52.0)

    world.addComponent('transform', {
      entityId: cracId,
      type: 'cooling',
      name: 'Test CRAC',
      siteId
    } as TransformComponent)

    world.addComponent('power', {
      entityId: cracId,
      wattage: 1000,
      load: 1.0,
      isPowered: true
    } as PowerComponent)

    const cracThermal = {
      entityId: cracId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 50.0,
      btuOutput: -50000,
      lastUpdate: Date.now()
    } as ThermalComponent
    world.addComponent('thermal', cracThermal)

    thermalSystem.update(1.0)

    expect(cracThermal.isThrottled).toBe(true)
  })

  it('should shut down the cooling unit and publish a critical alert if room ambient temp exceeds 60°C', () => {
    const cracId = 'crac-4'
    const siteId = 'site-4'

    world.registerEntity(cracId)

    // Set ambient room temperature to 62°C (exceeds max operating limit of 60C)
    ThermalSystem.siteAmbientTemps.set(siteId, 62.0)

    world.addComponent('transform', {
      entityId: cracId,
      type: 'cooling',
      name: 'Super CRAC',
      siteId
    } as TransformComponent)

    const cracPower = {
      entityId: cracId,
      wattage: 1000,
      load: 1.0,
      isPowered: true
    } as PowerComponent
    world.addComponent('power', cracPower)

    world.addComponent('thermal', {
      entityId: cracId,
      temperature: 22.0,
      isThrottled: false,
      fanSpeedPercent: 50.0,
      btuOutput: -50000,
      lastUpdate: Date.now()
    } as ThermalComponent)

    let caughtAlert = false
    world.eventBus.subscribe('system:alert', (payload) => {
      const alert = payload as { severity: string; message: string }
      if (alert.severity === 'critical' && alert.message.includes('High-temperature thermal shutdown')) {
        caughtAlert = true
      }
    })

    thermalSystem.update(1.0)

    expect(cracPower.isPowered).toBe(false)
    expect(caughtAlert).toBe(true)
  })
})
