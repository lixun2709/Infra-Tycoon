import { describe, it, expect } from 'vitest'
import { World } from '../../World'
import { StorageSystem } from '../StorageSystem'
import type {
  StorageComponent,
  PowerComponent,
  TransformComponent,
  ConnectionComponent
} from '../../types'

describe('Day 41 Advanced Storage Subsystem Simulation', () => {
  it('should model tier-based drive wear (NVMe wearing 5x slower, SSD 2x slower)', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nvmeId = 'storage-nvme'
    const hddId = 'storage-hdd'

    // Register entities
    world.registerEntity(nvmeId)
    world.registerEntity(hddId)

    // Common transforms
    world.addComponent('transform', { entityId: nvmeId, siteId: 'site-1', type: 'storage' } as TransformComponent)
    world.addComponent('transform', { entityId: hddId, siteId: 'site-1', type: 'storage' } as TransformComponent)

    // Common power
    world.addComponent('power', { entityId: nvmeId, isPowered: true } as PowerComponent)
    world.addComponent('power', { entityId: hddId, isPowered: true } as PowerComponent)

    // Storage components
    world.addComponent('storage', {
      entityId: nvmeId,
      totalStorageTB: 10,
      usedStorageTB: 2,
      ioPSLimit: 100000,
      ioPSUsed: 50000,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 10.0,
      tier: 'nvme'
    } as StorageComponent)

    world.addComponent('storage', {
      entityId: hddId,
      totalStorageTB: 10,
      usedStorageTB: 2,
      ioPSLimit: 100000,
      ioPSUsed: 50000,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 10.0,
      tier: 'hdd'
    } as StorageComponent)

    system.update(1.0)

    const nvme = world.getComponent<StorageComponent>('storage', nvmeId)!
    const hdd = world.getComponent<StorageComponent>('storage', hddId)!

    const nvmeWear = nvme.driveDegradation - 10.0
    const hddWear = hdd.driveDegradation - 10.0

    // NVMe should wear exactly 5x slower than HDD (ratio 0.2)
    expect(nvmeWear).toBeLessThan(hddWear)
    expect(hddWear / nvmeWear).toBeCloseTo(5.0, 1)
  })

  it('should process RAID 6 dual parity states (survives 2 disk failures, fails on 3rd)', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-raid6'
    world.registerEntity(nodeId)

    world.addComponent('transform', { entityId: nodeId, siteId: 'site-1', type: 'storage' } as TransformComponent)
    world.addComponent('power', { entityId: nodeId, isPowered: true } as PowerComponent)
    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 100,
      usedStorageTB: 20,
      ioPSLimit: 20000,
      ioPSUsed: 100,
      raidLevel: 'RAID6',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 99.5,
      failedDrives: 0
    } as StorageComponent)

    // 1st failure: should enter degraded (75% performance)
    system.update(1.0)
    const storage = world.getComponent<StorageComponent>('storage', nodeId)!
    expect(storage.storageStatus).toBe('degraded')
    expect(storage.failedDrives).toBe(1)
    expect(storage.ioPSLimit).toBe(15000) // 75% of 20000

    // 2nd failure: should enter highly_degraded (40% performance)
    storage.driveDegradation = 99.8
    system.update(1.0)
    expect(storage.storageStatus).toBe('highly_degraded')
    expect(storage.failedDrives).toBe(2)
    expect(storage.ioPSLimit).toBe(8000) // 40% of 20000

    // 3rd failure: catastrophic total failure
    storage.driveDegradation = 99.9
    system.update(1.0)
    expect(storage.storageStatus).toBe('failed')
  })

  it('should aggregate disk shelf capacity & IOPS limits through transit cabled paths', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const controller = 'san-controller'
    const switchNode = 'storage-switch'
    const shelfA = 'shelf-01'
    const shelfB = 'shelf-02'

    world.registerEntity(controller)
    world.registerEntity(switchNode)
    world.registerEntity(shelfA)
    world.registerEntity(shelfB)

    // Transforms
    world.addComponent('transform', { entityId: controller, siteId: 's1', type: 'storage' } as TransformComponent)
    world.addComponent('transform', { entityId: switchNode, siteId: 's1', type: 'network' } as TransformComponent)
    world.addComponent('transform', { entityId: shelfA, siteId: 's1', type: 'storage' } as TransformComponent)
    world.addComponent('transform', { entityId: shelfB, siteId: 's1', type: 'storage' } as TransformComponent)

    // Storage components
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
      usedStorageTB: 30,
      ioPSLimit: 5000,
      raidLevel: 'JBOD',
      storageStatus: 'healthy',
      driveDegradation: 0
    } as StorageComponent)

    world.addComponent('storage', {
      entityId: shelfB,
      totalStorageTB: 200,
      usedStorageTB: 40,
      ioPSLimit: 8000,
      raidLevel: 'JBOD',
      storageStatus: 'healthy',
      driveDegradation: 0
    } as StorageComponent)

    // Connection components: Controller -> Switch -> ShelfA, Switch -> ShelfB
    const conn1 = 'c1'
    const conn2 = 'c2'
    const conn3 = 'c3'
    world.registerEntity(conn1)
    world.registerEntity(conn2)
    world.registerEntity(conn3)

    world.addComponent('connection', {
      entityId: conn1,
      startNodeId: controller,
      endNodeId: switchNode,
      status: 'active'
    } as ConnectionComponent)

    world.addComponent('connection', {
      entityId: conn2,
      startNodeId: switchNode,
      endNodeId: shelfA,
      status: 'active'
    } as ConnectionComponent)

    world.addComponent('connection', {
      entityId: conn3,
      startNodeId: switchNode,
      endNodeId: shelfB,
      status: 'active'
    } as ConnectionComponent)

    system.update(1.0)

    const cStor = world.getComponent<StorageComponent>('storage', controller)!
    // Expected capacity aggregation: Controller (50) + ShelfA (100) + ShelfB (200) = 350 TB
    expect(cStor.totalStorageTB).toBe(350)
    expect(cStor.usedStorageTB).toBe(80) // 10 + 30 + 40
    expect(cStor.ioPSLimit).toBe(23000) // 10000 + 5000 + 8000
  })

  it('should sync storage replication limited by path bottleneck throughput', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const master = 'array-master'
    const replica = 'array-replica'

    world.registerEntity(master)
    world.registerEntity(replica)

    world.addComponent('transform', { entityId: master, siteId: 's1', type: 'storage' } as TransformComponent)
    world.addComponent('transform', { entityId: replica, siteId: 's2', type: 'storage' } as TransformComponent)

    world.addComponent('storage', {
      entityId: master,
      totalStorageTB: 100,
      usedStorageTB: 40,
      ioPSLimit: 10000,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      driveDegradation: 0
    } as StorageComponent)

    world.addComponent('storage', {
      entityId: replica,
      totalStorageTB: 100,
      usedStorageTB: 0,
      ioPSLimit: 10000,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      driveDegradation: 0,
      replicationSourceId: master,
      replicationProgress: 0
    } as StorageComponent)

    // Cabled replica network link: 10 Gbps bottleneck capacity
    const link = 'link-rep'
    world.registerEntity(link)
    world.addComponent('connection', {
      entityId: link,
      startNodeId: master,
      endNodeId: replica,
      bandwidthGbps: 10.0,
      throughputGbps: 10.0,
      status: 'active'
    } as ConnectionComponent)

    system.update(1.0)

    const repStorage = world.getComponent<StorageComponent>('storage', replica)!
    expect(repStorage.replicationProgress).toBeGreaterThan(0)
    // Bottleneck 10 Gbps syncs 10 / 8000 = 0.00125 TB per sec.
    expect(repStorage.usedStorageTB).toBeCloseTo(0.00125, 4)
  })
})
