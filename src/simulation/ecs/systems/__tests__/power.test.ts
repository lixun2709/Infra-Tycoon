import { describe, it, expect, beforeEach } from 'vitest'
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

    // Base wattage 400W
    world.addComponent('power', {
      entityId: serverId,
      wattage: 400,
      load: 0.4,
      isPowered: true,
      efficiency: 0.9,
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

    world.addComponent('power', { entityId: nodeA, wattage: 300, isPowered: true, feedSource: 'A' } as PowerComponent)
    world.addComponent('power', { entityId: nodeB, wattage: 300, isPowered: true, feedSource: 'B' } as PowerComponent)
    world.addComponent('power', { entityId: nodeBoth, wattage: 300, isPowered: true, feedSource: 'both' } as PowerComponent)

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
    world.addComponent('power', { entityId: rackId, wattage: 0, load: 0, isPowered: true } as PowerComponent)
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
})
