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
})
