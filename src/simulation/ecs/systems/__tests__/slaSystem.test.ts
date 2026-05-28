import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { SlaSystem } from '../SlaSystem'
import type { 
  ApplicationComponent, 
  ContractComponent, 
  PowerComponent, 
  TransformComponent 
} from '../../types'

describe('SlaSystem', () => {
  it('should strictly evaluate redundancy logic across different fault domains', () => {
    const world = new World()
    const system = new SlaSystem(world)

    const contractId = 'contract-1'
    const appId = 'wordpress'

    world.registerEntity(contractId)
    world.addComponent('contract', {
      entityId: contractId,
      blueprintId: 'ecom_pro',
      currentStatus: 'healthy',
      totalTicks: 0,
      uptimeTicks: 0,
      accumulatedPenalty: 0,
      monthlyRevenue: 1000
    } as ContractComponent)

    // Node 1 - Rack A
    world.registerEntity('node-1')
    world.addComponent('power', { entityId: 'node-1', isPowered: true } as PowerComponent)
    world.addComponent('transform', { entityId: 'node-1', parentRackId: 'rack-A', healthStatus: 'nominal' } as TransformComponent)
    world.addComponent('application', { entityId: 'node-1', nodeId: 'node-1', appId: appId, status: 'running' } as ApplicationComponent)

    // Node 2 - Rack A (Same fault domain)
    world.registerEntity('node-2')
    world.addComponent('power', { entityId: 'node-2', isPowered: true } as PowerComponent)
    world.addComponent('transform', { entityId: 'node-2', parentRackId: 'rack-A', healthStatus: 'nominal' } as TransformComponent)
    world.addComponent('application', { entityId: 'node-2', nodeId: 'node-2', appId: appId, status: 'running' } as ApplicationComponent)

    // Node 3 - Postgres DB (needed for ecom_pro)
    world.registerEntity('node-3')
    world.addComponent('power', { entityId: 'node-3', isPowered: true } as PowerComponent)
    world.addComponent('transform', { entityId: 'node-3', parentRackId: 'rack-C', healthStatus: 'nominal' } as TransformComponent)
    world.addComponent('application', { entityId: 'node-3', nodeId: 'node-3', appId: 'postgres', status: 'running' } as ApplicationComponent)

    // Tick the system 60 times to trigger SLA evaluation
    for (let i = 0; i < 60; i++) {
      system.update(1.0)
    }

    const contract = world.getComponent<ContractComponent>('contract', contractId)!
    // Should be violating because both apps are in Rack A (redundancy = 1 fault domain)
    expect(contract.currentStatus).toBe('violating')
    expect(contract.accumulatedPenalty).toBeGreaterThan(0)

    // Now move Node 2 to Rack B
    const transform2 = world.getComponent<TransformComponent>('transform', 'node-2')!
    transform2.parentRackId = 'rack-B'

    for (let i = 0; i < 60; i++) {
      system.update(1.0)
    }

    // Now it should be healthy! 
    expect(contract.currentStatus).toBe('healthy')
  })

  it('should trigger SLA bankruptcy alert on massive penalties', () => {
    const world = new World()
    const system = new SlaSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const contractId = 'contract-bankrupt'
    world.registerEntity(contractId)
    world.addComponent('contract', {
      entityId: contractId,
      blueprintId: 'gov_secure', // 2500 penalty per tick
      currentStatus: 'healthy',
      totalTicks: 0,
      uptimeTicks: 0,
      accumulatedPenalty: 0,
      monthlyRevenue: 1000
    } as ContractComponent)

    for (let i = 0; i <= 24060; i++) {
      system.update(1.0)
    }

    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      severity: 'critical',
      message: expect.stringContaining('SLA Bankruptcy')
    }))
  })


})
