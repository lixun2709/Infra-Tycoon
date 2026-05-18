import { describe, it, expect } from 'vitest'
import { World } from '../../World'
import { PacketSystem } from '../PacketSystem'
import type { 
  TransformComponent, 
  PowerComponent, 
  ConnectionComponent 
} from '../../types'

describe('ECS Packet Simulation Subsystem Core', () => {
  it('should register connection entities and run aggregate-flow deterministic network demands', () => {
    const world = new World()
    const system = new PacketSystem(world)

    const serverId = 'srv-compute-01'
    const switchId = 'sw-core-01'
    const connId = 'link-srv-to-sw'

    // 1. Setup Nodes
    world.registerEntity(serverId)
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      siteId: 'site-alpha'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 500,
      load: 1.0, // Active server load
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.registerEntity(switchId)
    world.addComponent('transform', {
      entityId: switchId,
      type: 'network',
      siteId: 'site-alpha'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: switchId,
      wattage: 100,
      load: 0.5,
      isPowered: true,
      efficiency: 0.95
    } as PowerComponent)

    // 2. Setup Connection
    world.registerEntity(connId)
    world.addComponent('connection', {
      entityId: connId,
      startNodeId: serverId,
      startPortId: 'port-1',
      endNodeId: switchId,
      endPortId: 'port-10',
      bandwidthGbps: 10.0,
      throughputGbps: 0.0,
      latencyMs: 1.0,
      status: 'active',
      syncProgress: 0
    } as ConnectionComponent)

    // Set high base network load
    PacketSystem.networkLoad = 1.0 // 100% additional demand load

    // Run PacketSystem tick
    system.update(1.0)

    const connComp = world.getComponent<ConnectionComponent>('connection', connId)!
    expect(connComp).toBeDefined()
    expect(connComp.throughputGbps).toBeGreaterThan(0.0) // Demand load must be generated and synced
    expect(connComp.throughputGbps).toBeCloseTo(1.6, 1) // Base demand for compute is 0.8 * (1 + 1.0) = 1.6
  })

  it('should dynamically apply queuing latency penalties when connection bandwidth is congested', () => {
    const world = new World()
    const system = new PacketSystem(world)

    const serverId = 'srv-heavy-storage'
    const switchId = 'sw-dist-01'
    const connId = 'link-srv-to-sw-2'

    // Storage server generates very high network demand
    world.registerEntity(serverId)
    world.addComponent('transform', {
      entityId: serverId,
      type: 'storage',
      siteId: 'site-alpha'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 800,
      load: 1.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.registerEntity(switchId)
    world.addComponent('transform', {
      entityId: switchId,
      type: 'network',
      siteId: 'site-alpha'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: switchId,
      wattage: 100,
      load: 0.2,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    // Constrained bandwidth link (only 1 Gbps)
    world.registerEntity(connId)
    world.addComponent('connection', {
      entityId: connId,
      startNodeId: serverId,
      startPortId: 'port-1',
      endNodeId: switchId,
      endPortId: 'port-2',
      bandwidthGbps: 1.0, // Tiny bandwidth
      throughputGbps: 0.0,
      latencyMs: 1.0,
      status: 'active',
      syncProgress: 0
    } as ConnectionComponent)

    PacketSystem.networkLoad = 2.0 // Heavy network load (200% scaling)

    // Run PacketSystem tick
    system.update(1.0)

    const connComp = world.getComponent<ConnectionComponent>('connection', connId)!
    expect(connComp.status).toBe('degraded') // Bandwidth saturation must flag link degraded
    expect(connComp.throughputGbps).toBe(1.0) // Saturation clamps throughput to maximum bandwidth
    expect(connComp.latencyMs).toBeGreaterThan(1.0) // Exponential queuing delay must trigger (>1ms buffering)
  })

  it('should drop throughput completely and set latency to maximum if a connection is blocked by compliance', () => {
    const world = new World()
    const system = new PacketSystem(world)

    const serverId = 'srv-compute-02'
    const switchId = 'sw-core-02'
    const connId = 'link-blocked'

    world.registerEntity(serverId)
    world.addComponent('transform', {
      entityId: serverId,
      type: 'compute',
      siteId: 'site-alpha'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: serverId,
      wattage: 500,
      load: 1.0,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.registerEntity(switchId)
    world.addComponent('transform', {
      entityId: switchId,
      type: 'network',
      siteId: 'site-alpha'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: switchId,
      wattage: 100,
      load: 0.5,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    // Blocked Connection
    world.registerEntity(connId)
    world.addComponent('connection', {
      entityId: connId,
      startNodeId: serverId,
      startPortId: 'port-1',
      endNodeId: switchId,
      endPortId: 'port-2',
      bandwidthGbps: 10.0,
      throughputGbps: 5.0,
      latencyMs: 1.0,
      status: 'blocked', // Blocked status
      isBlockedByCompliance: true,
      syncProgress: 50.0
    } as ConnectionComponent)

    system.update(1.0)

    const connComp = world.getComponent<ConnectionComponent>('connection', connId)!
    expect(connComp.throughputGbps).toBe(0.0) // Complete blackout
    expect(connComp.latencyMs).toBeCloseTo(999.0, 0) // Heavy drop latency buffering penalty
  })
})
