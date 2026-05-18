import { describe, it, expect } from 'vitest'
import { World } from '../../World'
import { TelemetrySystem } from '../TelemetrySystem'
import type { 
  TelemetryComponent, 
  PowerComponent, 
  ThermalComponent, 
  StorageComponent,
  TransformComponent,
  ConnectionComponent
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
    expect(TelemetrySystem.simStats.averageUptimeRatio).toBe(1.0)
    expect(TelemetrySystem.simStats.overheatedNodeCount).toBe(1)
    expect(TelemetrySystem.simStats.totalPowerDrawKW).toBe(0.4)
    expect(TelemetrySystem.simStats.totalStorageUsedTB).toBe(4)
    expect(TelemetrySystem.simStats.totalStorageCapacityTB).toBe(10)
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

    expect(TelemetrySystem.simStats.congestedLinkCount).toBe(1)
  })
})
