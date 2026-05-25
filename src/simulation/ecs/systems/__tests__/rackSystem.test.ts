import { describe, it, expect, beforeEach } from 'vitest'
import { World } from '../../World'
import { RackSystem } from '../RackSystem'
import { PowerSystem } from '../PowerSystem'
import { ObservabilitySystem } from '../ObservabilitySystem'
import type { 
  RackComponent, 
  PowerComponent, 
  TransformComponent,
  ThermalComponent
} from '../../types'

describe('Rack Subsystem ECS Tests', () => {
  let world: World
  let rackSystem: RackSystem
  let powerSystem: PowerSystem
  let obsSystem: ObservabilitySystem

  beforeEach(() => {
    world = new World()
    obsSystem = new ObservabilitySystem(world)
    rackSystem = new RackSystem(world)
    powerSystem = new PowerSystem(world)
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
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent)

    // Add server in rack with 900W load (below 1.0 kW threshold to avoid phase imbalance checking)
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 1,
      siteId: 'site-1'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 900, // 0.9 kW
      load: 0.9,
      isPowered: true,
      efficiency: 1.0
    } as PowerComponent)

    // Run systems
    powerSystem.update(1.0)
    rackSystem.update(1.0)

    const rackComp = world.getComponent<RackComponent>('rack', rackId)!
    const rackPower = world.getComponent<PowerComponent>('power', rackId)!

    expect(rackPower.load).toBe(0.9) // 0.9 kW
    expect(rackComp.status).toBe('online')
    expect(rackComp.currentPowerKW).toBe(0.9)
    expect(obsSystem.flushAlerts().length).toBe(0)
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
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent)

    // Mount three servers of 2000W each across slots 1, 2, 3 (balanced phases: B, C, A)
    // Total overload: 6.0 kW (exceeds 5.0 kW maxPowerKW limit)
    for (let i = 0; i < 3; i++) {
      const subServerId = `server-2-${i}`
      world.registerEntity(subServerId)
      world.addComponent('transform', {
        entityId: subServerId,
        type: 'compute',
        parentRackId: rackId,
        slotIndex: i + 1,
        siteId: 'site-1'
      } as TransformComponent)

      world.addComponent('power', {
        entityId: subServerId,
        wattage: 2000, // 2 kW each
        load: 2.0,
        isPowered: true,
        efficiency: 1.0
      } as PowerComponent)
    }

    powerSystem.update(1.0)
    rackSystem.update(1.0)

    const rackComp = world.getComponent<RackComponent>('rack', rackId)!
    expect(rackComp.status).toBe('power_overload')

    const alerts = obsSystem.flushAlerts()
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
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    const serverPower = {
      entityId: serverId,
      wattage: 900, // 0.9 kW (safe now, and below 1 kW to avoid phase imbalance checks)
      load: 0.9,
      isPowered: true,
      efficiency: 1.0
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
    const alerts = obsSystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('info')
    expect(alerts[0]!.message).toContain('[RACK RECOVERY]')
  })

  it('should dynamically update slot occupancy maps and report booking conflicts', () => {
    const rackId = 'rack-conflict-test'
    const serverIdA = 'server-conflict-a'
    const serverIdB = 'server-conflict-b'

    world.registerEntity(rackId)
    world.registerEntity(serverIdA)
    world.registerEntity(serverIdB)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'Conflict Rack',
      siteId: 'site-1'
    } as TransformComponent)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online' as const,
      hasHighDensityPDU: false,
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    // Mount server A at slot 10 (size 2U)
    world.addComponent('transform', {
      entityId: serverIdA,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 10,
      uHeight: 2,
      siteId: 'site-1'
    } as TransformComponent)

    // Mount server B at slot 11 (size 1U) - creates a collision overlap at slot 11!
    world.addComponent('transform', {
      entityId: serverIdB,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 11,
      uHeight: 1,
      siteId: 'site-1'
    } as TransformComponent)

    rackSystem.update(1.0)

    // Verify slotOccupancy mapping
    expect(rackComp.slotOccupancy[10]).toBe(true)
    expect(rackComp.slotOccupancy[11]).toBe(true)
    expect(rackComp.slotOccupancy[12]).toBe(false)

    // Verify collision alert
    const alerts = obsSystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('warning')
    expect(alerts[0]!.message).toContain('[RACK SLOT COLLISION]')
  })

  it('should scale PDU maxPowerKW limit dynamically when high-density PDU is upgraded', () => {
    const rackId = 'rack-hd-upgrade'
    world.registerEntity(rackId)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online' as const,
      hasHighDensityPDU: true,
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    rackSystem.update(1.0)

    expect(rackComp.maxPowerKW).toBe(15.0)
  })

  it('should detect boundary violations for slots exceeding 42U', () => {
    const rackId = 'rack-bound-test'
    const serverId = 'server-oob'
    world.registerEntity(rackId)
    world.registerEntity(serverId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'OOB Rack',
      siteId: 'site-1'
    } as TransformComponent)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online' as const,
      hasHighDensityPDU: false,
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    // Compute unit exceeding the top slot (U42 + 2U = slot 43 out of bounds)
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      parentRackId: rackId,
      slotIndex: 42,
      uHeight: 2,
      siteId: 'site-1'
    } as TransformComponent)

    rackSystem.update(1.0)

    const alerts = obsSystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('warning')
    expect(alerts[0]!.message).toContain('[RACK BOUNDARY VIOLATION]')
  })

  it('should calculate equipment weights and report structural warning when limit exceeded', () => {
    const rackId = 'rack-weight-test'
    world.registerEntity(rackId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'Weight Rack',
      siteId: 'site-1'
    } as TransformComponent)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 5.0,
      currentPowerKW: 0,
      status: 'online' as const,
      hasHighDensityPDU: false,
      slotOccupancy: [],
      collisionOccupancy: [],
      maxWeightKG: 200.0 // Low limit for testing
    } as RackComponent
    world.addComponent('rack', rackComp)

    // Mount 8 heavy Disk Shelves (40kg each = 320kg total)
    for (let i = 1; i <= 8; i++) {
      const serverId = `shelf-${i}`
      world.registerEntity(serverId)
      world.addComponent('transform', {
        entityId: serverId,
        type: 'compute',
        catalogKey: 'DISK_SHELF_2U',
        parentRackId: rackId,
        slotIndex: i * 2,
        uHeight: 2,
        siteId: 'site-1'
      } as TransformComponent)
    }

    rackSystem.update(1.0)

    expect(rackComp.totalWeightKG).toBe(320.0)
    expect(rackComp.weightStatus).toBe('structural_warning')

    const alerts = obsSystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('warning')
    expect(alerts[0]!.message).toContain('[RACK WEIGHT EXCEEDED]')
  })

  it('should derate PDU maxPowerKW limit under high ambient temperatures', () => {
    const rackId = 'rack-derating-test'
    world.registerEntity(rackId)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 10.0,
      currentPowerKW: 0,
      status: 'online' as const,
      hasHighDensityPDU: false,
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    // Ambient temperature of 45C (10C above 35C threshold => 20% de-rating)
    world.addComponent('thermal', {
      entityId: rackId,
      temperature: 45.0,
      isThrottled: false,
      fanSpeedPercent: 50.0,
      btuOutput: 0.0,
      lastUpdate: 0
    } as ThermalComponent)

    rackSystem.update(1.0)

    expect(rackComp.deratedMaxPowerKW).toBe(8.0) // 10kW - 20% de-rating = 8kW
  })

  it('should detect phase imbalance and fire warnings under significant load', () => {
    const rackId = 'rack-imbalance-test'
    world.registerEntity(rackId)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      name: 'Phase Rack',
      siteId: 'site-1'
    } as TransformComponent)

    const rackComp = {
      entityId: rackId,
      maxPowerKW: 15.0,
      currentPowerKW: 0,
      status: 'online' as const,
      hasHighDensityPDU: true,
      slotOccupancy: [],
      collisionOccupancy: []
    } as RackComponent
    world.addComponent('rack', rackComp)

    // Add power component with highly imbalanced phase loads (P_A: 3kW, P_B: 0.5kW, P_C: 0.5kW => Total: 4kW)
    world.addComponent('power', {
      entityId: rackId,
      wattage: 4000,
      load: 4.0,
      isPowered: true,
      efficiency: 1.0,
      phaseLoadsWatts: [3000, 500, 500],
      phaseLoadsVA: [3000, 500, 500]
    } as PowerComponent)

    rackSystem.update(1.0)

    expect(rackComp.hasPhaseImbalance).toBe(true)

    const alerts = obsSystem.flushAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0]!.severity).toBe('warning')
    expect(alerts[0]!.message).toContain('[PHASE IMBALANCE ALERT]')
  })
})
