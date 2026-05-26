import { describe, it, expect } from 'vitest'
import { World } from '../../World'
import { TelemetrySystem } from '../TelemetrySystem'
import { CircularBuffer } from '../../../../utils/CircularBuffer'
import type { 
  TelemetryComponent, 
  PowerComponent, 
  ThermalComponent, 
  StorageComponent,
  TransformComponent,
  ConnectionComponent,
  RackComponent
} from '../../types'

describe('Deterministic Simulation Telemetry Subsystem', () => {
  it('should initialize and aggregate per-entity operational metrics correctly', () => {
    const world = new World()
    const system = new TelemetrySystem(world)

    const nodeId = 'srv-telemetry-01'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      type: 'compute',
      siteId: 'site-alpha',
      degradation: 60 // Network degradation above 50
    } as TransformComponent)

    world.addComponent('telemetry', {
      entityId: nodeId,
      uptimeTicks: 0,
      totalTicks: 0,
      powerSpikesCount: 0,
      thermalThrottlingTicks: 0,
      networkCongestionTicks: 0,
      storageIopsThrottlingTicks: 0,
      auditViolationsCount: 0
    } as TelemetryComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 500,
      load: 0.4,
      isPowered: true,
      efficiency: 0.95
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 75.0, // Hotspot threshold (>= 70)
      isThrottled: true, // Throttled ticks
      fanSpeedPercent: 80,
      btuOutput: 1500,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 10,
      usedStorageTB: 4,
      ioPSLimit: 2000,
      ioPSUsed: 2500, // Exceeding IOPS threshold
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 0
    } as StorageComponent)

    // Tick the telemetry system
    system.update(1.0)

    const tc = world.getComponentMap<TelemetryComponent>('telemetry').get(nodeId)!
    expect(tc.totalTicks).toBe(1)
    expect(tc.uptimeTicks).toBe(1)
    expect(tc.thermalThrottlingTicks).toBe(1)
    expect(tc.storageIopsThrottlingTicks).toBe(1)
    expect(tc.networkCongestionTicks).toBe(1)

    // Check aggregated SimStats
    expect(system.simStats.averageUptimeRatio).toBe(1.0)
    expect(system.simStats.overheatedNodeCount).toBe(1)
    expect(system.simStats.totalPowerDrawKW).toBe(0.4)
    expect(system.simStats.totalStorageUsedTB).toBe(4)
    expect(system.simStats.totalStorageCapacityTB).toBe(10)
  })

  it('should compile active congested link count from connection components', () => {
    const world = new World()
    const system = new TelemetrySystem(world)

    const connId = 'conn-01'
    world.registerEntity(connId)

    world.addComponent('connection', {
      entityId: connId,
      startNodeId: 'node-a',
      startPortId: 'p1',
      endNodeId: 'node-b',
      endPortId: 'p2',
      bandwidthGbps: 10,
      throughputGbps: 9,
      latencyMs: 1.2,
      status: 'degraded', // Congested
      type: 'ethernet'
    } as ConnectionComponent)

    system.update(1.0)

    expect(system.simStats.congestedLinkCount).toBe(1)
  })

  it('should maintain node metric histories, aggregate site-wide trends, and trigger dynamic anomaly alarms', () => {
    const world = new World()
    const system = new TelemetrySystem(world)

    const nodeId = 'srv-telemetry-v2'
    const rackId = 'rack-01'
    world.registerEntity(nodeId)
    world.registerEntity(rackId)

    // Setup transform
    world.addComponent('transform', {
      entityId: nodeId,
      type: 'compute',
      siteId: 'site-beta',
      name: 'Super Compute Server'
    } as TransformComponent)

    world.addComponent('transform', {
      entityId: rackId,
      type: 'rack',
      siteId: 'site-beta'
    } as TransformComponent)

    // Setup telemetry
    world.addComponent('telemetry', {
      entityId: nodeId,
      uptimeTicks: 0,
      totalTicks: 0,
      powerSpikesCount: 0,
      thermalThrottlingTicks: 0,
      networkCongestionTicks: 0,
      storageIopsThrottlingTicks: 0,
      auditViolationsCount: 0
    } as TelemetryComponent)

    // Setup power
    world.addComponent('power', {
      entityId: nodeId,
      wattage: 500,
      load: 0.8,
      isPowered: true,
      efficiency: 0.95
    } as PowerComponent)

    // Setup thermal
    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 25.0,
      isThrottled: false,
      fanSpeedPercent: 40,
      btuOutput: 100,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('rack', {
      entityId: rackId,
      maxPowerKW: 0.5, // Tiny power breaker budget to trigger saturation
      currentPowerKW: 0.4,
      status: 'online',
      coolingCapacityKW: 5.0,
      containedAisle: 'none'
    } as unknown as RackComponent)

    // Setup alerts listener
    const alertsFired: Array<{ severity: 'info' | 'warning' | 'critical'; message: string; nodeId?: string }> = []
    world.eventBus.subscribe('system:alert', (evt) => {
      alertsFired.push(evt as { severity: 'info' | 'warning' | 'critical'; message: string; nodeId?: string })
    })

    // Tick 1: baseline temperature of 25.0°C
    ;(system as any).executionTickCounter = 0
    system.update(1.0)

    const tc = world.getComponentMap<TelemetryComponent>('telemetry').get(nodeId)!
    expect(tc.tempHistory).toBeDefined()
    expect(tc.tempHistory!.buffer[0]).toBeCloseTo(25.0, 5)
    expect(tc.powerHistory!.buffer[0]).toBeCloseTo(0.8, 5)

    // Verify site-wide aggregates
    expect(system.sitePowerHistory.has('site-beta')).toBe(true)
    expect(system.sitePowerHistory.get('site-beta')!.buffer[0]).toBeCloseTo(0.8, 5)
    expect(system.siteTempHistory.get('site-beta')!.buffer[0]).toBeCloseTo(25.0, 5)

    // Trigger Anomaly: Rapid heat spike (+6°C in a single tick)
    const thermalComp = world.getComponentMap<ThermalComponent>('thermal').get(nodeId)!
    thermalComp.temperature = 31.0

    // Tick 2: Trigger temperature spike alarm & site power breaker capacity alarm (>90% of 0.5KW max budget)
    ;(system as any).executionTickCounter = 60
    system.update(1.0)

    expect(tc.tempHistory!.buffer[1]).toBe(31.0)
    expect(alertsFired.length).toBeGreaterThan(0)
    
    // Check if temperature spike alert was logged
    const tempAlert = alertsFired.find(a => a.message.includes('Rapid silicon temperature spike'))!
    expect(tempAlert).toBeDefined()
    expect(tempAlert.severity).toBe('warning')

    // Check if power saturation alert was logged (0.8KW load > 90% of 0.5KW max capacity)
    const powerAlert = alertsFired.find(a => a.message.includes('power draw saturation threat'))!
    expect(powerAlert).toBeDefined()
    expect(powerAlert.severity).toBe('critical')
  })

  it('should track powerSpikesCount and auditViolationsCount accurately under abnormal conditions', () => {
    const world = new World()
    const system = new TelemetrySystem(world)

    const nodeId = 'srv-anomalous'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      type: 'compute',
      siteId: 'site-gamma',
      degradation: 90 // High degradation (> 80) to trigger audit violations
    } as TransformComponent)

    world.addComponent('telemetry', {
      entityId: nodeId,
      uptimeTicks: 0,
      totalTicks: 0,
      powerSpikesCount: 0,
      thermalThrottlingTicks: 0,
      networkCongestionTicks: 0,
      storageIopsThrottlingTicks: 0,
      auditViolationsCount: 0,
      powerHistory: new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH),
      tempHistory: new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH),
      iopsHistory: new CircularBuffer(TelemetrySystem.MAX_HISTORY_LENGTH)
    } as TelemetryComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 500,
      load: 0.1,
      isPowered: true,
      efficiency: 0.95
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 75.0, // Overheated (>= 70) to trigger audit violations
      isThrottled: false,
      fanSpeedPercent: 40,
      btuOutput: 100,
      lastUpdate: Date.now()
    } as ThermalComponent)

    // Tick 1: Baseline load = 0.1
    ;(system as any).executionTickCounter = 0
    system.update(1.0)
    
    const tc = world.getComponentMap<TelemetryComponent>('telemetry').get(nodeId)!
    expect(tc.auditViolationsCount).toBe(1) // Temperature >= 70 AND degradation > 80
    expect(tc.powerSpikesCount).toBe(0)

    // Trigger sudden huge power spike: 0.1 -> 0.8 (delta = 0.7 > 0.15, variance = 700% > 50%)
    const powerComp = world.getComponentMap<PowerComponent>('power').get(nodeId)!
    powerComp.load = 0.8

    // Tick 2: Spike occurs
    ;(system as any).executionTickCounter = 60
    system.update(1.0)
    expect(tc.powerSpikesCount).toBe(1)
    expect(tc.auditViolationsCount).toBe(2) // still in warning conditions
  })
})
