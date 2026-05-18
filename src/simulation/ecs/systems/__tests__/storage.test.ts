import { describe, it, expect } from 'vitest'
import { World } from '../../World'
import { StorageSystem } from '../StorageSystem'
import type { StorageComponent, PowerComponent, TransformComponent, ThermalComponent, ApplicationComponent } from '../../types'

describe('Storage Systems Subsystem ECS Simulation', () => {
  it('should wear down storage array drives deterministically proportional to active I/O loads', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-array-0'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      siteId: 'site-a',
      type: 'storage'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 500,
      load: 0.5,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 100,
      usedStorageTB: 20,
      ioPSLimit: 10000,
      ioPSUsed: 5000, // 50% saturated
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 10 // Start at 10%
    } as StorageComponent)

    // First update tick
    system.update(1.0)

    const storage = world.getComponent<StorageComponent>('storage', nodeId)!
    expect(storage.driveDegradation).toBeGreaterThan(10.0)
    
    // Idle nodes should degrade slower
    storage.ioPSUsed = 0
    const wearBeforeIdle = storage.driveDegradation
    system.update(1.0)
    expect(storage.driveDegradation - wearBeforeIdle).toBeLessThan(0.01)
  })

  it('should trigger direct failed state on RAID0 or JBOD configurations upon drive wear failure', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-jbod-0'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      siteId: 'site-a',
      type: 'storage'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 300,
      load: 0.3,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 50,
      usedStorageTB: 10,
      ioPSLimit: 5000,
      ioPSUsed: 100,
      raidLevel: 'JBOD',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 99.5 // Close to fail
    } as StorageComponent)

    system.update(1.0)

    const storage = world.getComponent<StorageComponent>('storage', nodeId)!
    expect(storage.storageStatus).toBe('failed')
  })

  it('should tolerate single drive loss on RAID5 and enter degraded mode, failing on subsequent loss', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-raid5-0'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      siteId: 'site-a',
      type: 'storage'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 600,
      load: 0.6,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 150,
      usedStorageTB: 30,
      ioPSLimit: 12000,
      ioPSUsed: 200,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 99.5 // Wear failure threshold
    } as StorageComponent)

    // First drive failure
    system.update(1.0)

    const storage = world.getComponent<StorageComponent>('storage', nodeId)!
    expect(storage.storageStatus).toBe('degraded')
    expect(storage.ioPSLimit).toBe(6000) // Degraded performance limit reduction (50%)

    // Set drive degradation back to high and trigger second failure
    storage.driveDegradation = 99.9
    system.update(1.0)
    expect(storage.storageStatus).toBe('failed')
  })

  it('should progress automatic rebuild machine once array degradation is repaired to zero', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-rebuild-0'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      siteId: 'site-a',
      type: 'storage'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 600,
      load: 0.6,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 200,
      usedStorageTB: 40,
      ioPSLimit: 8000,
      ioPSUsed: 0,
      raidLevel: 'RAID5',
      storageStatus: 'rebuilding', // Rebuilding state triggered by repair
      rebuildProgress: 20,
      driveDegradation: 0
    } as StorageComponent)

    // Rebuild tick progression
    system.update(1.0)

    const storage = world.getComponent<StorageComponent>('storage', nodeId)!
    expect(storage.rebuildProgress).toBe(30)
    expect(storage.storageStatus).toBe('rebuilding')

    // Ticking past 100% rebuild completion
    system.update(8.0)
    expect(storage.storageStatus).toBe('healthy')
    expect(storage.rebuildProgress).toBe(0)
    expect(storage.ioPSLimit).toBe(16000) // Original capacity limits fully restored
  })

  it('should increase temperature and throttle node when IOPS loads saturate array limit budget', () => {
    const world = new World()
    const system = new StorageSystem(world)

    const nodeId = 'storage-thrash-0'
    world.registerEntity(nodeId)

    world.addComponent('transform', {
      entityId: nodeId,
      siteId: 'site-a',
      type: 'storage'
    } as TransformComponent)

    world.addComponent('power', {
      entityId: nodeId,
      wattage: 400,
      load: 0.4,
      isPowered: true,
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: nodeId,
      temperature: 30.0,
      isThrottled: false,
      btuOutput: 1000,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('storage', {
      entityId: nodeId,
      totalStorageTB: 100,
      usedStorageTB: 10,
      ioPSLimit: 2000, // Limit is 2000
      ioPSUsed: 0,
      raidLevel: 'RAID5',
      storageStatus: 'healthy',
      rebuildProgress: 0,
      driveDegradation: 0
    } as StorageComponent)

    // Add postgres application entity to generate 4000 IOPS
    const appId = 'app-postgres'
    world.registerEntity(appId)

    world.addComponent('application', {
      entityId: appId,
      appId: 'postgres', // generates 4000 IOPS
      nodeId: nodeId, // Direct link to host node!
      status: 'running',
      progress: 100
    } as ApplicationComponent)

    system.update(1.0)

    const thermal = world.getComponent<ThermalComponent>('thermal', nodeId)!
    expect(thermal.temperature).toBeGreaterThan(30.0)
    expect(thermal.isThrottled).toBe(true)
  })
})
