import { describe, it, expect } from 'vitest'
import { World } from '../../World'
import { StorageSystem } from '../StorageSystem'
import type {
  StorageComponent,
  PowerComponent,
  TransformComponent,
  ConnectionComponent,
  ApplicationComponent
} from '../../types'

describe('Day 50 Advanced Storage Systems Subsystem (V3 Mechanics)', () => {
  it('should model deduplication and compression storage reduction and compute overhead', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-controller-v3'
    const appId = 'app-postgres-v3'
    world.registerEntity(nodeId)
    world.registerEntity(appId)

    // Transforms & Power
    world.addComponent('transform', { entityId: nodeId, siteId: 'site-1', type: 'storage' } as TransformComponent)
    world.addComponent('power', { entityId: nodeId, isPowered: true } as PowerComponent)

    // Postgres app component causing high IOPS workload
    world.addComponent('application', {
      entityId: appId,
      appId: 'postgres',
      nodeId: nodeId,
      status: 'running',
      progress: 100
    } as ApplicationComponent)

    // Storage: deduplication and compression enabled
    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 100,
      usedStorageTB: 24, // 24 TB logical used
      ioPSLimit: 20000,
      ioPSUsed: 0,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 0.0,
      tier: 'nvme',
      deduplicationEnabled: true,
      compressionEnabled: true,
      deduplicationRatio: 2.5,
      compressionRatio: 2.0
    } as StorageComponent)

    system.update(1.0)

    const storage = world.getComponent<StorageComponent>('storage', nodeId)!

    // Physical used should be usedStorageTB / (dedupRatio * compRatio)
    // 24 / (2.5 * 2.0) = 24 / 5.0 = 4.8 TB
    expect(storage.physicalUsedStorageTB).toBeCloseTo(4.8, 2)

    // Postgres base IOPS = 4000
    // Deduplication enabled (+15%), Compression enabled (+10%)
    // Cumulative overhead is +25%: 4000 * 1.25 = 5000 IOPS
    expect(storage.ioPSUsed).toBe(5000)
  })

  it('should model RAID-aware Write Amplification Factor (WAF) drive wear scaling', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const raid6Id = 'storage-raid6-waf'
    const raid0Id = 'storage-raid0-waf'

    world.registerEntity(raid6Id)
    world.registerEntity(raid0Id)

    world.addComponent('transform', { entityId: raid6Id, siteId: 'site-1', type: 'storage' } as TransformComponent)
    world.addComponent('transform', { entityId: raid0Id, siteId: 'site-1', type: 'storage' } as TransformComponent)

    world.addComponent('power', { entityId: raid6Id, isPowered: true } as PowerComponent)
    world.addComponent('power', { entityId: raid0Id, isPowered: true } as PowerComponent)

    // Storage RAID 6 (6.0 WAF)
    world.addComponent('storage', {
      entityId: raid6Id,
      totalStorageTB: 100,
      usedStorageTB: 10,
      ioPSLimit: 10000,
      ioPSUsed: 5000, // active load
      raidLevel: 'RAID6',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 10.0,
      tier: 'ssd'
    } as StorageComponent)

    // Storage RAID 0 (1.0 WAF)
    world.addComponent('storage', {
      entityId: raid0Id,
      totalStorageTB: 100,
      usedStorageTB: 10,
      ioPSLimit: 10000,
      ioPSUsed: 5000, // active load
      raidLevel: 'RAID0',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 10.0,
      tier: 'ssd'
    } as StorageComponent)

    system.update(1.0)

    const r6 = world.getComponent<StorageComponent>('storage', raid6Id)!
    const r0 = world.getComponent<StorageComponent>('storage', raid0Id)!

    expect(r6.writeAmplificationFactor).toBe(6.0)
    expect(r0.writeAmplificationFactor).toBe(1.0)

    const wearR6 = r6.driveDegradation - 10.0
    const wearR0 = r0.driveDegradation - 10.0

    // RAID 6 wear should be scaled significantly higher than RAID 0 wear under active workload
    expect(wearR6).toBeGreaterThan(wearR0)
    expect(wearR6 / wearR0).toBeCloseTo(6.0, 1)
  })

  it('should compute dynamic tier-specific & RAID rebuild curves', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nvmeR6Id = 'rebuild-nvme-raid6'
    const hddR5Id = 'rebuild-hdd-raid5'

    world.registerEntity(nvmeR6Id)
    world.registerEntity(hddR5Id)

    world.addComponent('transform', { entityId: nvmeR6Id, siteId: 'site-1', type: 'storage' } as TransformComponent)
    world.addComponent('transform', { entityId: hddR5Id, siteId: 'site-1', type: 'storage' } as TransformComponent)

    world.addComponent('power', { entityId: nvmeR6Id, isPowered: true } as PowerComponent)
    world.addComponent('power', { entityId: hddR5Id, isPowered: true } as PowerComponent)

    // Storage NVMe RAID 6 (NVMe = 3.0 mult, RAID 6 = 0.5 complexity penalty)
    world.addComponent('storage', {
      entityId: nvmeR6Id,
      totalStorageTB: 100,
      usedStorageTB: 10,
      ioPSLimit: 10000,
      ioPSUsed: 0,
      raidLevel: 'RAID6',
      storageStatus: 'rebuilding',
      rebuildProgress: 10.0,
      driveDegradation: 0,
      tier: 'nvme'
    } as StorageComponent)

    // Storage HDD RAID 5 (HDD = 0.5 mult, RAID 5 = 0.7 complexity penalty)
    world.addComponent('storage', {
      entityId: hddR5Id,
      totalStorageTB: 100,
      usedStorageTB: 10,
      ioPSLimit: 10000,
      ioPSUsed: 0,
      raidLevel: 'RAID5',
      storageStatus: 'rebuilding',
      rebuildProgress: 10.0,
      driveDegradation: 0,
      tier: 'hdd'
    } as StorageComponent)

    system.update(1.0)

    const nvmeR6 = world.getComponent<StorageComponent>('storage', nvmeR6Id)!
    const hddR5 = world.getComponent<StorageComponent>('storage', hddR5Id)!

    // NVMe R6: base (5) * tier (3.0) * raid (0.5) = 7.5% per tick
    // Progress should be 10 + 7.5 = 17.5%
    expect(nvmeR6.rebuildProgress).toBeCloseTo(17.5, 2)

    // HDD R5: base (5) * tier (0.5) * raid (0.7) = 1.75% per tick
    // Progress should be 10 + 1.75 = 11.75%
    expect(hddR5.rebuildProgress).toBeCloseTo(11.75, 2)
  })

  it('should cap disk shelf IOPS contributions through bandwidth network path bottlenecks', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const controller = 'san-controller-bottleneck'
    const shelfA = 'shelf-bottleneck-01'

    world.registerEntity(controller)
    world.registerEntity(shelfA)

    world.addComponent('transform', { entityId: controller, siteId: 'site-1', type: 'storage' } as TransformComponent)
    // Shelf entity must include 'shelf' in ID to be aggregated as a shelf cabled to controller
    world.addComponent('transform', { entityId: shelfA, siteId: 'site-1', type: 'storage' } as TransformComponent)

    world.addComponent('storage', {
      entityId: controller,
      totalStorageTB: 50,
      usedStorageTB: 10,
      ioPSLimit: 10000,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      driveDegradation: 0
    } as StorageComponent)

    world.addComponent('storage', {
      entityId: shelfA,
      totalStorageTB: 100,
      usedStorageTB: 20,
      ioPSLimit: 10000, // Shelf capable of 10000 IOPS
      raidLevel: 'JBOD',
      storageStatus: 'healthy',
      driveDegradation: 0
    } as StorageComponent)

    // Bandwidth connection limiting path to 2 Gbps
    const link = 'link-bottleneck'
    world.registerEntity(link)
    world.addComponent('connection', {
      entityId: link,
      startNodeId: controller,
      endNodeId: shelfA,
      bandwidthGbps: 2.0, // 2 Gbps path
      status: 'active'
    } as ConnectionComponent)

    system.update(1.0)

    const controllerStorage = world.getComponent<StorageComponent>('storage', controller)!

    // Shelf contribution capped at 2.0 Gbps * 2000 IOPS/Gbps = 4000 IOPS
    // Total aggregate limit: 10000 (controller) + min(10000, 4000) = 14000 IOPS
    expect(controllerStorage.ioPSLimit).toBe(14000)
  })
})
