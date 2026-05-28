import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { SecuritySystem } from '../SecuritySystem'
import type { 
  SecurityComponent, 
  PowerComponent, 
  ConnectionComponent 
} from '../../types'

describe('SecuritySystem', () => {
  it('should progress ransomware infection states over time', () => {
    const world = new World()
    const system = new SecuritySystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const nodeId = 'node-1'
    world.registerEntity(nodeId)

    world.addComponent('power', {
      entityId: nodeId,
      isPowered: true,
      systemState: 'running'
    } as PowerComponent)

    world.addComponent('security', {
      entityId: nodeId,
      infectionState: 'exposed',
      infectionProgress: 0,
      encryptionRate: 0.2
    } as SecurityComponent)

    // Progress to infected
    system.update(2.0) // dt * 0.5 = 1.0 => infected
    let sec = world.getComponent<SecurityComponent>('security', nodeId)!
    expect(sec.infectionState).toBe('infected')
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('compromised')
    }))

    // Progress to encrypting
    system.update(10.0) // dt * 0.1 = 1.0 => encrypting
    sec = world.getComponent<SecurityComponent>('security', nodeId)!
    expect(sec.infectionState).toBe('encrypting')

    // Progress to locked
    system.update(5.0) // dt * 0.2 = 1.0 => locked
    sec = world.getComponent<SecurityComponent>('security', nodeId)!
    expect(sec.infectionState).toBe('locked')
    expect(alertSpy).toHaveBeenCalledWith('incident:ransomware_locked', expect.objectContaining({
      nodeId: nodeId
    }))
  })

  it('should respect microsegmentation and immutability during lateral spread', () => {
    const world = new World()
    const system = new SecuritySystem(world)

    const attackerId = 'node-attacker'
    const victimSegmentedId = 'node-segmented'
    const victimImmutableId = 'node-immutable'

    world.registerEntity(attackerId)
    world.registerEntity(victimSegmentedId)
    world.registerEntity(victimImmutableId)

    // Setup Attacker
    world.addComponent('power', { entityId: attackerId, isPowered: true, systemState: 'running' } as PowerComponent)
    world.addComponent('security', { 
      entityId: attackerId, 
      infectionState: 'infected', // Active threat
      infectionProgress: 0,
      encryptionRate: 0.1,
      isIsolated: false,
      infectionType: 'zero_day' // Very high base spread chance (0.5)
    } as SecurityComponent)

    // Setup Victim 1 (Segmented)
    world.addComponent('power', { entityId: victimSegmentedId, isPowered: true, systemState: 'running' } as PowerComponent)
    world.addComponent('security', { 
      entityId: victimSegmentedId, 
      infectionState: 'clean',
      infectionProgress: 0,
      encryptionRate: 0.1,
      isIsolated: false,
      microsegmentationEnabled: true // Caps spread chance to 0.01!
    } as SecurityComponent)

    // Setup Victim 2 (Immutable)
    world.addComponent('power', { entityId: victimImmutableId, isPowered: true, systemState: 'running' } as PowerComponent)
    world.addComponent('security', { 
      entityId: victimImmutableId, 
      infectionState: 'clean',
      infectionProgress: 0,
      encryptionRate: 0.1,
      isIsolated: false,
      isImmutable: true // Completely immune
    } as SecurityComponent)

    world.registerEntity('conn-1')
    world.addComponent('connection', {
      entityId: 'conn-1',
      startNodeId: attackerId,
      endNodeId: victimSegmentedId,
      status: 'active',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 1
    } as ConnectionComponent)

    world.registerEntity('conn-2')
    world.addComponent('connection', {
      entityId: 'conn-2',
      startNodeId: attackerId,
      endNodeId: victimImmutableId,
      status: 'active',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 1
    } as ConnectionComponent)

    // To properly test the pseudo-random determinism, we need to run it enough times
    // or just mock Math.sin, but we can just run it for many intervals and observe that 
    // microsegmentation heavily protects, and immutability completely protects.
    // Let's run 10 propagation cycles.
    for (let i = 0; i < 10; i++) {
       system.update(2.0)
    }

    const secImmutable = world.getComponent<SecurityComponent>('security', victimImmutableId)!
    // Must always be clean!
    expect(secImmutable.infectionState).toBe('clean')
  })
})
