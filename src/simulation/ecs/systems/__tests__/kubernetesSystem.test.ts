import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { KubernetesSystem } from '../KubernetesSystem'
import type { 
  KubernetesNodeComponent, 
  PodComponent, 
  PowerComponent 
} from '../../types'

describe('KubernetesSystem', () => {
  it('should OOMKill pod and reset memory usage when memory limit is exceeded', () => {
    const world = new World()
    const system = new KubernetesSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const worker1 = 'worker-1'
    const pod1 = 'pod-1'

    world.registerEntity(worker1)
    world.registerEntity(pod1)

    world.addComponent('kubernetes', {
      entityId: worker1,
      role: 'worker',
      clusterId: 'cluster-1',
      cpuCapacity: 8,
      memoryCapacity: 16000,
      maxPods: 110,
      kubeletStatus: 'running'
    } as KubernetesNodeComponent)

    world.addComponent('power', {
      entityId: worker1,
      isPowered: true,
      systemState: 'running'
    } as PowerComponent)

    // Master node for quorum
    world.registerEntity('master-1')
    world.addComponent('kubernetes', {
      entityId: 'master-1',
      role: 'master',
      clusterId: 'cluster-1',
      kubeletStatus: 'running',
      totalMasters: 1
    } as KubernetesNodeComponent)
    world.addComponent('power', {
      entityId: 'master-1',
      isPowered: true,
      systemState: 'running'
    } as PowerComponent)

    world.addComponent('pod', {
      entityId: pod1,
      nodeId: worker1,
      clusterId: 'cluster-1',
      serviceName: 'backend',
      status: 'running',
      cpuReq: 1.0,
      memoryReq: 1000,
      memoryLimit: 1200 // Memory request is close to limit, jitter will push it over
    } as PodComponent)

    // Force random to be high to trigger jitter
    const origRandom = Math.random
    Math.random = () => 0.49 // 1000 * 1.49 = 1490 > 1200

    system.update(1.0)
    
    Math.random = origRandom

    const pod = world.getComponent<PodComponent>('pod', pod1)!
    expect(pod.status).toBe('oomkilled')
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('OOMKilled'),
      severity: 'warning'
    }))
  })

  it('should mark pods as crashloop and evict when node loses power and quorum exists', () => {
    const world = new World()
    const system = new KubernetesSystem(world)
    
    const master1 = 'master-1'
    const worker1 = 'worker-1'
    const pod1 = 'pod-1'

    world.registerEntity(master1)
    world.registerEntity(worker1)
    world.registerEntity(pod1)

    world.addComponent('kubernetes', {
      entityId: master1,
      role: 'master',
      clusterId: 'cluster-1',
      totalMasters: 1,
      kubeletStatus: 'running'
    } as KubernetesNodeComponent)
    world.addComponent('power', { entityId: master1, isPowered: true, systemState: 'running' } as PowerComponent)

    world.addComponent('kubernetes', {
      entityId: worker1,
      role: 'worker',
      clusterId: 'cluster-1',
      kubeletStatus: 'offline'
    } as KubernetesNodeComponent)
    world.addComponent('power', { entityId: worker1, isPowered: false, systemState: 'off' } as PowerComponent)

    world.addComponent('pod', {
      entityId: pod1,
      nodeId: worker1,
      clusterId: 'cluster-1',
      status: 'running'
    } as PodComponent)

    system.update(10.0) // Crashloop state
    let pod = world.getComponent<PodComponent>('pod', pod1)!
    expect(pod.status).toBe('crashloop')
    expect(pod.evictionTimer).toBeGreaterThan(0)

    system.update(300.0) // Eviction timeout
    pod = world.getComponent<PodComponent>('pod', pod1)!
    expect(pod.nodeId).toBe('')
    expect(pod.status).toBe('pending')
  })

  it('should ignore pod evictions when etcd quorum is lost', () => {
    const world = new World()
    const system = new KubernetesSystem(world)
    
    const master1 = 'master-1'
    const master2 = 'master-2'
    const master3 = 'master-3'
    const worker1 = 'worker-1'
    const pod1 = 'pod-1'

    world.registerEntity(master1)
    world.registerEntity(master2)
    world.registerEntity(master3)
    world.registerEntity(worker1)
    world.registerEntity(pod1)

    // 3 Masters total, need 2 for quorum. All 3 offline.
    world.addComponent('kubernetes', { entityId: master1, role: 'master', clusterId: 'cluster-1', totalMasters: 3 } as KubernetesNodeComponent)
    world.addComponent('power', { entityId: master1, isPowered: false } as PowerComponent)
    
    world.addComponent('kubernetes', { entityId: master2, role: 'master', clusterId: 'cluster-1', totalMasters: 3 } as KubernetesNodeComponent)
    world.addComponent('power', { entityId: master2, isPowered: false } as PowerComponent)
    
    world.addComponent('kubernetes', { entityId: master3, role: 'master', clusterId: 'cluster-1', totalMasters: 3 } as KubernetesNodeComponent)
    world.addComponent('power', { entityId: master3, isPowered: false } as PowerComponent)

    world.addComponent('kubernetes', { entityId: worker1, role: 'worker', clusterId: 'cluster-1' } as KubernetesNodeComponent)
    world.addComponent('power', { entityId: worker1, isPowered: false } as PowerComponent)

    world.addComponent('pod', {
      entityId: pod1,
      nodeId: worker1,
      clusterId: 'cluster-1',
      status: 'running'
    } as PodComponent)

    system.update(10.0)
    
    const pod = world.getComponent<PodComponent>('pod', pod1)!
    // No quorum, should not alter status
    expect(pod.status).toBe('running')
  })
})
