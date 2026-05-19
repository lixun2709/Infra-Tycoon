import { describe, it, expect, beforeEach } from 'vitest'
import { World } from '../../World'
import { RackSystem } from '../RackSystem'
import { PowerSystem } from '../PowerSystem'
import { ObservabilitySystem } from '../ObservabilitySystem'
import type { 
  RackComponent, 
  PowerComponent, 
  TransformComponent
} from '../../types'

describe('Rack Subsystem ECS Tests', () => {
  let world: World
  let rackSystem: RackSystem
  let powerSystem: PowerSystem

  beforeEach(() => {
    world = new World()
    rackSystem = new RackSystem(world)
    powerSystem = new PowerSystem(world)
    ObservabilitySystem.clear()
  })

  it('should successfully calculate rack load and transition to online under safe limits', () => {
    const rackId = 'rack-1'
    const serverId = 'server-1'

    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'Rack Alpha',
      siteId: 'site-1'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: rackId,
      wattage: 0,
      load: 0,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    world.addComponent('rack', {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online',
      hasHighDensityPDU: false,
      slotOccupancy: []
    } as RackComponent)

    // Add server in rack with 3000W load
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 1,
      siteId: 'site-1'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 3000, // 3 kW
      load: 3.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    // Run systems
    powerSystem.update(1.0)
    rackSystem.update(1.0)

    const rackComp = world.getComponent<RackComponent>('rack', rackId)!
    const rackPower = world.getComponent<PowerComponent>('power', rackId)!

    expect(rackPower.load).toBe(3.0) // 3 kW
    expect(rackComp.status).toBe('online')
    expect(rackComp.currentPowerKW).toBe(3.0)
    expect(ObservabilitySystem.flushAlerts().length).toBe(0)
  })

  it('should trigger power_overload and push a critical alert when power load exceeds limit', () => {
    const rackId = 'rack-2'
    const serverId = 'server-2'

    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'Rack Beta',
      siteId: 'site-1'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: rackId,
      wattage: 0,
      load: 0,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    world.addComponent('rack', {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online',
      hasHighDensityPDU: false,
      slotOccupancy: []
    } as RackComponent)

    // Server exceeding rack capacity with 6000W load
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 1,
      siteId: 'site-1'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 6000, // 6 kW
      load: 6.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    powerSystem.update(1.0)
    rackSystem.update(1.0)

    const rackComp = world.getComponent<RackComponent>('rack', rackId)!
    expect(rackComp.status).toBe('power_overload')

    const alerts = ObservabilitySystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('critical')
    expect(alerts[0]!.message).toContain('[RACK OVERLOAD]')
    expect(alerts[0]!.message).toContain('Rack Beta')
  })

  it('should successfully clear overload state and fire a recovery alert when load drops back', () => {
    const rackId = 'rack-3'
    const serverId = 'server-3'

    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'Rack Gamma',
      siteId: 'site-1'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: rackId,
      wattage: 0,
      load: 0,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 6.0,
      status: 'power_overload' as const,
      hasHighDensityPDU: false,
      slotOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    const serverPower = {
      entityId: serverId,
      wattage: 3000, // 3 kW (safe now)
      load: 3.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent
    world.addComponent('power', serverPower)

    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 1,
      siteId: 'site-1'
    } as TransformComponent)

    powerSystem.update(1.0)
    rackSystem.update(1.0)

    expect(rackComp.status).toBe('online')
    const alerts = ObservabilitySystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('info')
    expect(alerts[0]!.message).toContain('[RACK RECOVERY]')
  })
})
