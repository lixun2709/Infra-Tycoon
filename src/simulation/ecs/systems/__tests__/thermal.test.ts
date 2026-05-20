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

  it('should model room relative humidity and trigger alerts on ESD / condensation bounds', () => {
    const world = new World()
    const system = new ThermalSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const siteId = 'site-humidity-test'
    const nodeId = 'srv-humi-01'

    ThermalSystem.siteAmbientHumidity.set(siteId, 45.0)

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

    // Run 1 tick: CRAC units not present so humidity drifts up towards regional 60.0%
    system.update(10.0)

    const siteHumidity = ThermalSystem.siteAmbientHumidity.get(siteId)!
    expect(siteHumidity).toBeGreaterThan(45.0)

    // Manually force very high humidity to test alert trigger
    ThermalSystem.siteAmbientHumidity.set(siteId, 79.9)
    system.update(5.0)
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      severity: 'critical',
      message: expect.stringContaining('High relative humidity')
    }))
  })

  it('should scale cooling efficiency and convective leakage based on Aisle Containment', () => {
    const world = new World()
    const system = new ThermalSystem(world)

    const siteId = 'site-containment-test'
    const rackId = 'rack-cold-01'
    const srvId = 'srv-cold-01'

    ThermalSystem.siteAmbientTemps.set(siteId, 30.0)

    world.registerEntity(rackId)
    world.registerEntity(srvId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      siteId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: rackId,
      temperature: 30.0,
      isThrottled: false,
      fanSpeedPercent: 0.0,
      btuOutput: 0.0,
      containmentType: 'cold_aisle',
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('transform', {
      entityId: srvId,
      type: 'compute',
      siteId,
      parentRackId: rackId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: srvId,
      temperature: 25.0,
      isThrottled: false,
      fanSpeedPercent: 20.0,
      btuOutput: 1000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // Run tick - cold aisle containment has convection exchange scaled down to 0.2
    system.update(1.0)

    const rackThermal = world.getComponent<ThermalComponent>('thermal', rackId)!
    // Should have very little convective heating from high room temp
    expect(rackThermal.temperature).toBeCloseTo(30.0, 1)
  })

  it('should coordinate redundant CRAC units into standby and perform Lead-Lag rotation', () => {
    const world = new World()
    const system = new ThermalSystem(world)

    const siteId = 'site-lead-lag'
    const crac1 = 'crac-01'
    const crac2 = 'crac-02'

    ThermalSystem.siteAmbientTemps.set(siteId, 22.0)

    world.registerEntity(crac1)
    world.registerEntity(crac2)

    world.addComponent('transform', {
      entityId: crac1,
      type: 'cooling',
      siteId,
      position: { x: 0, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: crac1,
      temperature: 20.0,
      isThrottled: false,
      fanSpeedPercent: 100.0,
      btuOutput: -50000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: crac1,
      wattage: 1000,
      load: 1.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('transform', {
      entityId: crac2,
      type: 'cooling',
      siteId,
      position: { x: 1, y: 0, z: 0 }
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: crac2,
      temperature: 20.0,
      isThrottled: false,
      fanSpeedPercent: 100.0,
      btuOutput: -50000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: crac2,
      wattage: 1000,
      load: 1.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    // Run tick - load is extremely low (0 servers), so total max capacity is 100000 BTU which is way more than 1.5 * active heat.
    // One unit must enter standby!
    system.update(1.0)

    const t1 = world.getComponent<ThermalComponent>('thermal', crac1)!
    const t2 = world.getComponent<ThermalComponent>('thermal', crac2)!

    // Expect exactly one CRAC unit to be in standby
    const standbyCount = (t1.isStandby ? 1 : 0) + (t2.isStandby ? 1 : 0)
    expect(standbyCount).toBe(1)
  })

  it('should gradually converge room temperature over time demonstrating large thermal inertia', () => {
    const world = new World()
    const system = new ThermalSystem(world)

    const siteId = 'site-inertia-test'
    ThermalSystem.siteAmbientTemps.set(siteId, 22.0)

    const srvId = 'srv-inertia-01'
    world.registerEntity(srvId)

    world.addComponent('transform', {
      entityId: srvId,
      type: 'compute',
      siteId
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: srvId,
      temperature: 22.0,
      fanSpeedPercent: 20.0,
      btuOutput: 1000.0,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // Very large load: 10000W
    world.addComponent('power', {
      entityId: srvId,
      wattage: 10000,
      load: 1.0,
      isPowered: true,
      efficiency: 0.8
    } as PowerComponent)

    // After 1 second of simulation, the room temperature should barely rise due to massive room thermal inertia
    system.update(1.0)
    const temp1 = ThermalSystem.siteAmbientTemps.get(siteId)!
    expect(temp1).toBeGreaterThan(22.0)
    expect(temp1).toBeLessThan(22.2) // Less than 0.2 degree rise in 1 second!

    // After 10 minutes of simulation, room temperature should drift much higher towards equilibrium
    for (let i = 0; i < 600; i++) {
      system.update(1.0)
    }
    const temp2 = ThermalSystem.siteAmbientTemps.get(siteId)!
    expect(temp2).toBeGreaterThan(temp1)
    expect(temp2).toBeGreaterThan(22.48) // Warmed up significantly over 10 minutes toward target 23.70C
  })

  it('should demonstrate that aisle containment reduces rack recirculation and keeps temperatures lower', () => {
    const world = new World()
    const system = new ThermalSystem(world)
    const siteId = 'site-containment-compare'
    ThermalSystem.siteAmbientTemps.set(siteId, 22.0)

    const rack1 = 'rack-no-containment'
    const rack2 = 'rack-cold-containment'

    world.registerEntity(rack1)
    world.registerEntity(rack2)

    world.addComponent('transform', { entityId: rack1, type: 'rack', siteId } as TransformComponent)
    world.addComponent('thermal', { entityId: rack1, temperature: 22.0, containmentType: 'none', lastUpdate: Date.now() } as ThermalComponent)

    world.addComponent('transform', { entityId: rack2, type: 'rack', siteId } as TransformComponent)
    world.addComponent('thermal', { entityId: rack2, temperature: 22.0, containmentType: 'cold_aisle', lastUpdate: Date.now() } as ThermalComponent)

    // Add high heat compute load to both racks
    const srv1 = 'srv-rack1'
    const srv2 = 'srv-rack2'
    world.registerEntity(srv1)
    world.registerEntity(srv2)

    world.addComponent('transform', { entityId: srv1, type: 'compute', parentRackId: rack1, siteId } as TransformComponent)
    world.addComponent('power', { entityId: srv1, wattage: 5000, load: 1.0, isPowered: true, efficiency: 0.8 } as PowerComponent)
    world.addComponent('thermal', { entityId: srv1, temperature: 22.0, fanSpeedPercent: 20.0, lastUpdate: Date.now() } as ThermalComponent)

    world.addComponent('transform', { entityId: srv2, type: 'compute', parentRackId: rack2, siteId } as TransformComponent)
    world.addComponent('power', { entityId: srv2, wattage: 5000, load: 1.0, isPowered: true, efficiency: 0.8 } as PowerComponent)
    world.addComponent('thermal', { entityId: srv2, temperature: 22.0, fanSpeedPercent: 20.0, lastUpdate: Date.now() } as ThermalComponent)

    // Run for 3 minutes (180s)
    for (let i = 0; i < 180; i++) {
      system.update(1.0)
    }

    const tempRack1 = world.getComponent<ThermalComponent>('thermal', rack1)!.temperature
    const tempRack2 = world.getComponent<ThermalComponent>('thermal', rack2)!.temperature

    // Rack 2 (cold containment) has reduced recirculation, so it must stay much cooler than Rack 1 (no containment)
    expect(tempRack2).toBeLessThan(tempRack1)
  })
})
