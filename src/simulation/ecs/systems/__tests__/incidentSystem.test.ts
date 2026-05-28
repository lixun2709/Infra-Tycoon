import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { IncidentSystem } from '../IncidentSystem'
import type { 
  IncidentComponent, 
  TransformComponent, 
  PowerComponent,
  StorageComponent
} from '../../types'

describe('IncidentSystem', () => {
  it('should isolate a site during a DR Drill', () => {
    const world = new World()
    const system = new IncidentSystem(world)

    const siteId = 'site-primary'
    const nodeId1 = 'srv-1'
    const nodeId2 = 'srv-2'
    const incidentId = 'drill-1'

    world.registerEntity(nodeId1)
    world.registerEntity(nodeId2)
    world.registerEntity(incidentId)

    world.addComponent('transform', {
      entityId: nodeId1,
      siteId: siteId,
      isBlackholed: false,
      healthStatus: 'nominal'
    } as TransformComponent)

    world.addComponent('transform', {
      entityId: nodeId2,
      siteId: 'site-secondary',
      isBlackholed: false,
      healthStatus: 'nominal'
    } as TransformComponent)

    world.addComponent('incident', {
      entityId: incidentId,
      incidentId: incidentId,
      type: 'drill',
      siteId: siteId,
      affectedNodes: [],
      elapsedSeconds: 0,
      rtoTargetSeconds: 300,
      rpoTargetSeconds: 10,
      isResolved: false,
      severity: 'critical'
    } as IncidentComponent)

    // Execute drill - elapsedSeconds becomes 1.0 (dt)
    system.update(1.0)

    const t1 = world.getComponent<TransformComponent>('transform', nodeId1)!
    const t2 = world.getComponent<TransformComponent>('transform', nodeId2)!

    expect(t1.isBlackholed).toBe(true) // Primary site isolated
    expect(t2.isBlackholed).toBe(false) // Secondary site unaffected
  })

  it('should trigger RTO violation if incident is not resolved within time limit', () => {
    const world = new World()
    const system = new IncidentSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const incidentId = 'inc-1'
    world.registerEntity(incidentId)

    const offlineNode = 'node-offline'
    world.registerEntity(offlineNode)
    world.addComponent('transform', {
      entityId: offlineNode,
      healthStatus: 'critical'
    } as TransformComponent)
    world.addComponent('power', {
      entityId: offlineNode,
      isPowered: false
    } as PowerComponent)

    world.addComponent('incident', {
      entityId: incidentId,
      incidentId: incidentId,
      type: 'power_outage',
      affectedNodes: [offlineNode],
      elapsedSeconds: 0,
      rtoTargetSeconds: 100, // Short RTO
      isResolved: false,
      hasAlertedRto: false,
      severity: 'critical'
    } as IncidentComponent)

    // A node that will never be healthy because it doesn't exist
    // So allResolved will be false

    system.update(150.0) // Exceeds RTO 100

    expect(alertSpy).toHaveBeenCalledWith('incident:rto_violation', expect.objectContaining({ incidentId }))
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('RTO of 100s missed'),
      severity: 'error'
    }))
  })

  it('should trigger RPO violation during drill if storage replication is missing', () => {
    const world = new World()
    const system = new IncidentSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const siteId = 'site-primary'
    const nodeId1 = 'storage-node-1'
    const incidentId = 'drill-rpo'

    world.registerEntity(nodeId1)
    world.registerEntity(incidentId)

    world.addComponent('transform', {
      entityId: nodeId1,
      siteId: siteId,
      isBlackholed: false
    } as TransformComponent)

    world.addComponent('storage', {
      entityId: nodeId1,
      totalStorageTB: 10,
      usedStorageTB: 5,
      // No replicationSourceId
    } as StorageComponent)

    world.addComponent('incident', {
      entityId: incidentId,
      incidentId: incidentId,
      type: 'drill',
      siteId: siteId,
      affectedNodes: [],
      elapsedSeconds: 0,
      rtoTargetSeconds: 300,
      rpoTargetSeconds: 10,
      isResolved: false,
      severity: 'critical'
    } as IncidentComponent)

    // Execute drill
    system.update(1.0) // Initial check for replication missing
    
    expect(alertSpy).toHaveBeenCalledWith('incident:rpo_violation', expect.objectContaining({ incidentId }))

    system.update(15.0) // Wait past RPO target of 10s

    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('RPO Target of 10s violated'),
      severity: 'error'
    }))

    const inc = world.getComponent<IncidentComponent>('incident', incidentId)!
    expect(inc.isResolved).toBe(true) // Drill forcibly fails and ends
  })

  it('should promote secondary storage to primary during drill and failback when resolved', () => {
    const world = new World()
    const system = new IncidentSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const siteId = 'site-primary'
    const nodeIdPrimary = 'storage-primary'
    const nodeIdSecondary = 'storage-secondary'
    const incidentId = 'drill-failover'

    world.registerEntity(nodeIdPrimary)
    world.registerEntity(nodeIdSecondary)
    world.registerEntity(incidentId)

    world.addComponent('transform', {
      entityId: nodeIdPrimary,
      siteId: siteId, // Will be isolated
      isBlackholed: false
    } as TransformComponent)

    world.addComponent('storage', {
      entityId: nodeIdPrimary,
      totalStorageTB: 10,
      usedStorageTB: 5,
    } as StorageComponent)

    world.addComponent('transform', {
      entityId: nodeIdSecondary,
      siteId: 'site-secondary',
      isBlackholed: false
    } as TransformComponent)

    world.addComponent('storage', {
      entityId: nodeIdSecondary,
      totalStorageTB: 10,
      usedStorageTB: 5,
      replicationSourceId: nodeIdPrimary // Replicating from primary
    } as StorageComponent)

    world.addComponent('incident', {
      entityId: incidentId,
      incidentId: incidentId,
      type: 'drill',
      siteId: siteId,
      affectedNodes: [],
      elapsedSeconds: 0,
      isResolved: false,
      severity: 'critical'
    } as IncidentComponent)

    // Wait until failover kicks in (elapsed >= 10s)
    system.update(12.0)
    
    // The secondary array should be promoted!
    let secondaryStorage = world.getComponent<StorageComponent>('storage', nodeIdSecondary)!
    expect(secondaryStorage.replicationSourceId).toBeUndefined()
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('DR Failover: Storage array promoted to Primary'),
      severity: 'warning'
    }))

    // Resolve drill
    const inc = world.getComponent<IncidentComponent>('incident', incidentId)!
    inc.isResolved = true
    system.update(1.0)

    // Secondary array should be demoted back to Secondary!
    secondaryStorage = world.getComponent<StorageComponent>('storage', nodeIdSecondary)!
    expect(secondaryStorage.replicationSourceId).toBe(nodeIdPrimary)
    expect(secondaryStorage.replicationProgress).toBe(0)
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('DR Failback: Storage array demoted to Secondary'),
      severity: 'info'
    }))
  })
})
