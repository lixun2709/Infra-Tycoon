import { describe, it, expect, beforeEach, vi } from 'vitest'
import { World } from '../../World'
import { PowerSystem } from '../PowerSystem'
import type { 
  RackComponent, 
  PowerComponent, 
  TransformComponent,
  ThermalComponent
} from '../../types'

describe('Enterprise Power Subsystem ECS Tests', () => {
  let world: World
  let powerSystem: PowerSystem

  beforeEach(() => {
    world = new World()
    powerSystem = new PowerSystem(world)
    PowerSystem.facilityFeeds.A = true
    PowerSystem.facilityFeeds.B = true
  })

  it('should dynamically scale wattage based on app load and fan speed', () => {
    const serverId = 'compute-node'
    world.registerEntity(serverId)

    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      siteId: 'site-1'
    } as TransformComponent)

    // Base wattage 400W, efficiency 1.0 (ideal AC to DC efficiency)
    world.addComponent('power', {
      entityId: serverId,
      wattage: 400,
      load: 0.4,
      isPowered: true,
      efficiency: 1.0,
      feedSource: 'both'
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: serverId,
      temperature: 30.0,
      fanSpeedPercent: 60.0 // 60% fan speed draws extra 30W
    } as ThermalComponent)

    // Test with no applications (utilization 0%)
    // formula: base * 1.0 + (60% * 50W) = 400 + 30 = 430W
    powerSystem.update(1.0)
    let powerComp = world.getComponent<PowerComponent>('power', serverId)!
    expect(powerComp.wattage).toBe(430.0)

    // Register active running app to increase utilization
    const appId = 'app-1'
    world.registerEntity(appId)
    world.addComponent('application', {
      entityId: appId,
      appId: 'web-srv',
      nodeId: serverId,
      status: 'running',
      progress: 100
    })

    // formula: 1 app => utilization 30%
    // draw = 400 * (1.0 + 0.15) + (30W) = 460 + 30 = 490W
    powerSystem.update(1.0)
    powerComp = world.getComponent<PowerComponent>('power', serverId)!
    expect(powerComp.wattage).toBeCloseTo(490.0, 3)
  })

  it('should enforce grid power supply feed failures', () => {
    const nodeA = 'node-a'
    const nodeB = 'node-b'
    const nodeBoth = 'node-both'

    world.registerEntity(nodeA)
    world.registerEntity(nodeB)
    world.registerEntity(nodeBoth)

    world.addComponent('transform', { entityId: nodeA, type: 'compute', siteId: 'site-1' } as TransformComponent)
    world.addComponent('transform', { entityId: nodeB, type: 'compute', siteId: 'site-1' } as TransformComponent)
    world.addComponent('transform', { entityId: nodeBoth, type: 'compute', siteId: 'site-1' } as TransformComponent)

    // Specify zero battery backup so they fail immediately on grid drop
    world.addComponent('power', { entityId: nodeA, wattage: 300, isPowered: true, feedSource: 'A', upsMaxBatterySeconds: 0, upsBatterySeconds: 0 } as PowerComponent)
    world.addComponent('power', { entityId: nodeB, wattage: 300, isPowered: true, feedSource: 'B', upsMaxBatterySeconds: 0, upsBatterySeconds: 0 } as PowerComponent)
    world.addComponent('power', { entityId: nodeBoth, wattage: 300, isPowered: true, feedSource: 'both', upsMaxBatterySeconds: 0, upsBatterySeconds: 0 } as PowerComponent)

    // Simulate facility transient: loss of Feed A grid line
    PowerSystem.facilityFeeds.A = false

    powerSystem.update(1.0)

    const compA = world.getComponent<PowerComponent>('power', nodeA)!
    const compB = world.getComponent<PowerComponent>('power', nodeB)!
    const compBoth = world.getComponent<PowerComponent>('power', nodeBoth)!

    expect(compA.isPowered).toBe(false)  // Lost feed A => goes down
    expect(compB.isPowered).toBe(true)   // Feed B is up => remains active
    expect(compBoth.isPowered).toBe(true) // Feed B is up, redundant supplies => remains active
  })

  it('should trigger PDU breaker trip under prolonged overload', () => {
    const rackId = 'rack-1'
    const serverId = 'server-1'

    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', { entityId: rackId, type: 'rack', siteId: 'site-1' } as TransformComponent)
    world.addComponent('power', { entityId: rackId, wattage: 0, load: 0, isPowered: true, upsMaxBatterySeconds: 0, upsBatterySeconds: 0 } as PowerComponent)
    world.addComponent('rack', { entityId: rackId, maxPowerKW: 2.0, status: 'online' } as RackComponent)

    world.addComponent('transform', { entityId: serverId, type: 'compute', parentRackId: rackId, siteId: 'site-1' } as TransformComponent)
    // Add heavy 3000W load (3.0kW > 2.0kW capacity limit)
    world.addComponent('power', { entityId: serverId, wattage: 3000, isPowered: true } as PowerComponent)

    // Tick 4 times (elapsed 4s / 10s limit)
    for (let i = 0; i < 4; i++) {
      powerSystem.update(1.0)
    }

    let rackPower = world.getComponent<PowerComponent>('power', rackId)!
    let serverPower = world.getComponent<PowerComponent>('power', serverId)!
    expect(rackPower.breakerTripped).toBeFalsy()
    expect(serverPower.isPowered).toBe(true) // Serves remain active during short surges

    // Tick another 6 times (cumulative 10s overload)
    for (let i = 0; i < 6; i++) {
      powerSystem.update(1.0)
    }

    rackPower = world.getComponent<PowerComponent>('power', rackId)!
    serverPower = world.getComponent<PowerComponent>('power', serverId)!

    expect(rackPower.breakerTripped).toBe(true)
    expect(rackPower.isPowered).toBe(false)
    expect(serverPower.isPowered).toBe(false) // Power automatically cut to all children!
  })

  it('should factor in PSU AC efficiency losses on power draw', () => {
    const serverId = 'compute-efficiency'
    world.registerEntity(serverId)

    world.addComponent('transform', { entityId: serverId, type: 'compute', siteId: 'site-1' } as TransformComponent)

    // Internal DC draw of 340W with a 85% efficient PSU: 340W / 0.85 = 400W AC load from PDU
    world.addComponent('power', {
      entityId: serverId,
      baseWattage: 340,
      isPowered: true,
      efficiency: 0.85
    } as PowerComponent)

    powerSystem.update(1.0)

    const powerComp = world.getComponent<PowerComponent>('power', serverId)!
    // Internal DC draw = 340 * 1.0 (0% util) + 0 (0% fan speed) = 340W
    // AC draw = 340 / 0.85 = 400W
    expect(powerComp.wattage).toBeCloseTo(400.0, 1)
  })

  it('should balance server loads across 3 phases in PDU and trigger breaker trip on phase imbalance', () => {
    const rackId = 'rack-3phase'
    const serverId = 'server-heavy-phaseA'

    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', { entityId: rackId, type: 'rack', siteId: 'site-1' } as TransformComponent)
    world.addComponent('power', { entityId: rackId, wattage: 0, load: 0, isPowered: true, upsMaxBatterySeconds: 0, upsBatterySeconds: 0 } as PowerComponent)
    // 3.0kW max total power. Standard phase limit = (3.0 / 3) * 1.15 = 1.15kW per phase.
    world.addComponent('rack', { entityId: rackId, maxPowerKW: 3.0, status: 'online' } as RackComponent)

    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 3, // slotIndex % 3 === 0 => Phase A
      siteId: 'site-1'
    } as TransformComponent)

    // Add heavy 1500W server on Phase A (1.5kW exceeds the single phase limit of 1.15kW, but total 1.5kW < 3.0kW)
    world.addComponent('power', {
      entityId: serverId,
      baseWattage: 1500,
      isPowered: true,
      efficiency: 1.0,
      phase: 'A'
    } as PowerComponent)

    // Mock alert publish
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    // Overload should sustain for 10s to trip
    for (let i = 0; i < 9; i++) {
      powerSystem.update(1.0)
    }

    let rackPower = world.getComponent<PowerComponent>('power', rackId)!
    expect(rackPower.breakerTripped).toBeFalsy()

    // 10th second - breaker trips!
    powerSystem.update(1.0)

    rackPower = world.getComponent<PowerComponent>('power', rackId)!
    expect(rackPower.breakerTripped).toBe(true)
    expect(rackPower.isPowered).toBe(false)
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      severity: 'critical',
      message: expect.stringContaining('Phase Imbalance')
    }))
  })

  it('should provide transient battery backup on utility failure and charge back up on recovery', () => {
    const rackId = 'rack-ups'
    world.registerEntity(rackId)

    world.addComponent('transform', { entityId: rackId, type: 'rack', siteId: 'site-1' } as TransformComponent)
    world.addComponent('rack', { entityId: rackId, maxPowerKW: 5.0, status: 'online' } as RackComponent)
    world.addComponent('power', {
      entityId: rackId,
      wattage: 0,
      load: 0,
      isPowered: true,
      upsMaxBatterySeconds: 30.0,
      upsBatterySeconds: 30.0,
      feedSource: 'both'
    } as PowerComponent)

    // Lose grid power feeds
    PowerSystem.facilityFeeds.A = false
    PowerSystem.facilityFeeds.B = false

    // Tick 10 seconds. Rack PDU should stay powered due to UPS battery discharging!
    for (let i = 0; i < 10; i++) {
      powerSystem.update(1.0)
    }

    let rackPower = world.getComponent<PowerComponent>('power', rackId)!
    expect(rackPower.isPowered).toBe(true)
    expect(rackPower.upsBatterySeconds).toBeCloseTo(20.0, 1) // 30s - 10s = 20s remaining

    // Grid power returns!
    PowerSystem.facilityFeeds.A = true
    PowerSystem.facilityFeeds.B = true

    // Tick 5 seconds. UPS should charge back up by 5s * 2.0 = 10s, returning to full 30s!
    for (let i = 0; i < 5; i++) {
      powerSystem.update(1.0)
    }

    rackPower = world.getComponent<PowerComponent>('power', rackId)!
    expect(rackPower.isPowered).toBe(true)
    expect(rackPower.upsBatterySeconds).toBe(30.0) // Restored to max capacity

    // Grid power lost again
    PowerSystem.facilityFeeds.A = false
    PowerSystem.facilityFeeds.B = false

    // Tick 35 seconds to deplete battery completely
    for (let i = 0; i < 35; i++) {
      powerSystem.update(1.0)
    }

    rackPower = world.getComponent<PowerComponent>('power', rackId)!
    expect(rackPower.isPowered).toBe(false) // Depleted battery => goes offline!
    expect(rackPower.upsBatterySeconds).toBe(0.0)
  })

  it('should exclude cooling type devices from IT PDU power aggregation but shut them down if parent PDU trips', () => {
    const rackId = 'rack-cooling-test'
    const coolingId = 'cooling-node'
    const serverId = 'server-node'

    world.registerEntity(rackId)
    world.registerEntity(coolingId)
    world.registerEntity(serverId)

    world.addComponent('transform', { entityId: rackId, type: 'rack', siteId: 'site-1' } as TransformComponent)
    world.addComponent('rack', { entityId: rackId, maxPowerKW: 5.0, status: 'online' } as RackComponent)
    world.addComponent('power', { entityId: rackId, wattage: 0, load: 0, isPowered: true } as PowerComponent)

    // Add In-Row CRAC (4U) (5000W load)
    world.addComponent('transform', {
      entityId: coolingId,
      type: 'cooling',
      parentRackId: rackId,
      slotIndex: 1,
      siteId: 'site-1'
    } as TransformComponent)
    world.addComponent('power', {
      entityId: coolingId,
      baseWattage: 5000,
      wattage: 5000,
      load: 5.0,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    // Add normal compute server (1200W load)
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 2,
      siteId: 'site-1'
    } as TransformComponent)
    world.addComponent('power', {
      entityId: serverId,
      baseWattage: 1200,
      wattage: 1200,
      load: 1.2,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    // Tick the power system
    powerSystem.update(1.0)

    let rackPower = world.getComponent<PowerComponent>('power', rackId)!
    let coolingPower = world.getComponent<PowerComponent>('power', coolingId)!
    let serverPower = world.getComponent<PowerComponent>('power', serverId)!

    // The rack load should ONLY include the 1.2kW server, completely excluding the 5.0kW CRAC unit load!
    // Since 1.2kW < 5.0kW rack limit, the breaker must remain active (untripped).
    expect(rackPower.load).toBeCloseTo(1.2, 2)
    expect(rackPower.breakerTripped).toBeFalsy()
    expect(coolingPower.isPowered).toBe(true)
    expect(serverPower.isPowered).toBe(true)

    // Now, force the rack breaker to trip by adding an extremely heavy load server
    const heavyServerId = 'heavy-server'
    world.registerEntity(heavyServerId)
    world.addComponent('transform', {
      entityId: heavyServerId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 3,
      siteId: 'site-1'
    } as TransformComponent)
    world.addComponent('power', {
      entityId: heavyServerId,
      baseWattage: 10000, // 10kW load (> 5kW rack capacity)
      wattage: 10000,
      load: 10.0,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    // Tick for 10 seconds to trigger breaker trip
    for (let i = 0; i < 10; i++) {
      powerSystem.update(1.0)
    }

    rackPower = world.getComponent<PowerComponent>('power', rackId)!
    coolingPower = world.getComponent<PowerComponent>('power', coolingId)!
    serverPower = world.getComponent<PowerComponent>('power', serverId)!
    const heavyServerPower = world.getComponent<PowerComponent>('power', heavyServerId)!

    // The breaker must be tripped, and both the IT equipment AND the cooling unit must be unpowered
    expect(rackPower.breakerTripped).toBe(true)
    expect(rackPower.isPowered).toBe(false)
    expect(serverPower.isPowered).toBe(false)
    expect(heavyServerPower.isPowered).toBe(false)
    expect(coolingPower.isPowered).toBe(false) // Physical dependency maintained!
  })
})
