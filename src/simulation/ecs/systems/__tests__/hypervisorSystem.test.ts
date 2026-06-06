 
import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { HypervisorSystem } from '../HypervisorSystem'
import type { 
  VmComponent, 
  PowerComponent, 
  TransformComponent,
  ThermalComponent
} from '../../types'

describe('HypervisorSystem', () => {
  it('should trigger High Availability (HA) when host loses power', () => {
    const world = new World()
    const system = new HypervisorSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const host1 = 'host-1'
    const host2 = 'host-2'
    const vm1 = 'vm-1'

    world.registerEntity(host1)
    world.registerEntity(host2)
    world.registerEntity(vm1)

    // Setup failed host
    world.addComponent('power', {
      entityId: host1,
      isPowered: false,
      systemState: 'off'
    } as PowerComponent)

    // Setup healthy host
    world.addComponent('power', {
      entityId: host2,
      isPowered: true,
      systemState: 'running'
    } as PowerComponent)

    // Setup VM on failed host
    world.addComponent('vm', {
      entityId: vm1,
      nodeId: host1,
      status: 'running',
      cpuCores: 2,
      memoryGB: 4
    } as VmComponent)

    system.update(1.0)

    const vm = world.getComponent<VmComponent>('vm', vm1)!
    expect(vm.nodeId).toBe(host2)
    expect(vm.status).toBe('booting')
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('HA Triggered'),
      severity: 'warning'
    }))
  })

  it('should calculate CPU Overcommit ratio and throttle when > 4.0', () => {
    const world = new World()
    const system = new HypervisorSystem(world)
    
    const host1 = 'host-1'
    world.registerEntity(host1)

    world.addComponent('transform', {
      entityId: host1,
      isThrottled: false
    } as TransformComponent)

    // Add many VMs to exceed 4.0 overcommit ratio (Assume 64 pCPUs default -> need > 256 vCPUs)
    for (let i = 0; i < 70; i++) {
      const vmId = `vm-${i}`
      world.registerEntity(vmId)
      world.addComponent('vm', {
        entityId: vmId,
        nodeId: host1,
        status: 'running',
        cpuCores: 4
      } as VmComponent)
    }

    system.update(1.0)

    const transform = world.getComponent<TransformComponent>('transform', host1)!
    expect(transform.isThrottled).toBe(true)
  })

  it('should evacuate VMs via DRS when host is thermally stressed', () => {
    const world = new World()
    const system = new HypervisorSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const hostHot = 'host-hot'
    const hostCool = 'host-cool'
    const vm1 = 'vm-drs-1'

    world.registerEntity(hostHot)
    world.registerEntity(hostCool)
    world.registerEntity(vm1)

    world.addComponent('thermal', {
      entityId: hostHot,
      temperature: 90.0,
      isThrottled: true
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: hostHot,
      isPowered: true,
      systemState: 'running'
    } as PowerComponent)

    world.addComponent('thermal', {
      entityId: hostCool,
      temperature: 30.0,
      isThrottled: false
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: hostCool,
      isPowered: true,
      systemState: 'running'
    } as PowerComponent)

    world.addComponent('vm', {
      entityId: vm1,
      nodeId: hostHot,
      status: 'running',
      cpuCores: 2
    } as VmComponent)

    // Force DRS interval
    system.update(6.0)

    const vm = world.getComponent<VmComponent>('vm', vm1)!
    expect(vm.status).toBe('migrating')
    expect(vm.migratingToNodeId).toBe(hostCool)
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('DRS Action'),
      severity: 'info'
    }))
  })

  it('should trigger svMotion when datastore exceeds 90% and find a host with adequate space', () => {
    const world = new World()
    const system = new HypervisorSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const hostFull = 'host-full'
    const hostAlmostFull = 'host-almost-full' // Cannot fit the VM
    const hostHealthy = 'host-healthy'
    const vm1 = 'vm-svmotion-1'

    world.registerEntity(hostFull)
    world.registerEntity(hostAlmostFull)
    world.registerEntity(hostHealthy)
    world.registerEntity(vm1)

    // Source host is 95% full
    world.addComponent('storage', {
      entityId: hostFull,
      totalStorageTB: 10,
      usedStorageTB: 9.5
    } as import('../../types').StorageComponent)
    world.addComponent('power', { entityId: hostFull, isPowered: true, systemState: 'running' } as PowerComponent)

    // Intermediate host has 70% used (which is < 80% default threshold)
    // BUT the VM is 2000GB (~2TB). 7 + 2 = 9TB, which is exactly 90% of 10TB. The system rejects if used+req > 90%.
    world.addComponent('storage', {
      entityId: hostAlmostFull,
      totalStorageTB: 10,
      usedStorageTB: 7.5 // 7.5 + 2 = 9.5TB (> 9.0TB threshold) -> Should be rejected
    } as import('../../types').StorageComponent)
    world.addComponent('power', { entityId: hostAlmostFull, isPowered: true, systemState: 'running' } as PowerComponent)

    // Healthy target host has plenty of space
    world.addComponent('storage', {
      entityId: hostHealthy,
      totalStorageTB: 10,
      usedStorageTB: 1.0
    } as import('../../types').StorageComponent)
    world.addComponent('power', { entityId: hostHealthy, isPowered: true, systemState: 'running' } as PowerComponent)

    world.addComponent('vm', {
      entityId: vm1,
      nodeId: hostFull,
      status: 'running',
      cpuCores: 2,
      storageGB: 2048 // 2TB VM!
    } as VmComponent)

    // Force DRS interval
    system.update(6.0)

    const vm = world.getComponent<VmComponent>('vm', vm1)!
    expect(vm.status).toBe('migrating')
    
    // It MUST pick the healthy host, because almost-full host would breach the 90% safe margin
    expect(vm.migratingToNodeId).toBe(hostHealthy)
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('svMotion Action'),
      severity: 'info'
    }))
  })
})

