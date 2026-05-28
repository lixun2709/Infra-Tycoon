import { describe, it, expect, vi } from 'vitest'
import { World } from '../../World'
import { TicketingSystem } from '../TicketingSystem'
import type { TicketComponent, TransformComponent, PowerComponent } from '../../types'

describe('TicketingSystem', () => {
  it('should deterministically sort tickets and dispatch technicians based on priority', () => {
    const world = new World()
    const system = new TicketingSystem(world)

    const nodeId = 'node-1'
    world.registerEntity(nodeId)
    world.addComponent('transform', {
      entityId: nodeId,
      degradation: 50,
      healthStatus: 'warning',
      maintenanceMode: true
    } as TransformComponent)

    // Add 6 tickets. Max technicians is 5.
    // P1 ticket should preempt/override if needed, but here we just test sorting and limit.
    for (let i = 1; i <= 6; i++) {
      const ticketId = `t-${i}`
      world.registerEntity(ticketId)
      world.addComponent('ticket', {
        entityId: ticketId,
        ticketId: ticketId,
        targetNodeId: nodeId,
        type: 'cpu',
        priority: i === 6 ? 'P1' : 'P4', // Make the last ticket P1
        status: 'queued',
        elapsedSeconds: 0,
        totalSeconds: 10
      } as TicketComponent)
    }

    // Tick the system to dispatch and cover travel time (15s) + 1s of work
    system.update(15.0)
    system.update(1.0)

    // P1 ticket should definitely be dispatched and arrived
    const p1Ticket = world.getComponent<TicketComponent>('ticket', 't-6')!
    expect(p1Ticket.status).toBe('arrived')
    expect(p1Ticket.elapsedSeconds).toBe(1.0)

    // Check how many P4 tickets were dispatched. Max limit is 5, but P1 bumps it to 10.
    // Wait, let's look at the logic:
    // If ticket.priority === 'P1', currentLimit = 10, else 5.
    // Since it's sorted, t-6 (P1) is evaluated first. activeTickets becomes 1. limit is 10.
    // Then t-1 (P4) evaluated. activeTickets is 1. limit is 5. Dispatched. activeTickets = 2.
    // ... t-4 (P4) evaluated. activeTickets is 4. limit is 5. Dispatched. activeTickets = 5.
    // t-5 (P4) evaluated. activeTickets is 5. limit is 5. activeTickets >= limit -> Queued!
    const p4TicketDispatched = world.getComponent<TicketComponent>('ticket', 't-4')!
    expect(p4TicketDispatched.status).toBe('arrived')

    const p4TicketQueued = world.getComponent<TicketComponent>('ticket', 't-5')!
    expect(p4TicketQueued.status).toBe('queued')
  })

  it('should actively preempt P4 tickets to make room for P1 emergencies and apply travel time', () => {
    const world = new World()
    const system = new TicketingSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const targetSiteId = 'site-alpha'
    world.registerEntity('node-1')
    world.addComponent('transform', {
      entityId: 'node-1',
      siteId: targetSiteId,
      degradation: 50,
      healthStatus: 'warning'
    } as TransformComponent)

    // Max technicians is 5. We create 5 P4 tickets first, let them start.
    for (let i = 1; i <= 5; i++) {
      const ticketId = `t-${i}`
      world.registerEntity(ticketId)
      world.addComponent('ticket', {
        entityId: ticketId,
        ticketId: ticketId,
        targetNodeId: 'node-1',
        type: 'cpu',
        priority: 'P4',
        status: 'diagnosing', // Already in progress
        elapsedSeconds: 2,
        totalSeconds: 10
      } as TicketComponent)
    }

    // Tick system so it acknowledges the 5 active P4 tickets
    system.update(1.0)
    
    // Now an emergency P1 arrives!
    world.registerEntity('t-6')
    world.addComponent('ticket', {
      entityId: 't-6',
      ticketId: 't-6',
      targetNodeId: 'node-1',
      type: 'cpu',
      priority: 'P1',
      status: 'queued',
      elapsedSeconds: 0,
      totalSeconds: 10
    } as TicketComponent)

    // Tick the system. The P1 should preempt a P4 ticket.
    system.update(1.0)

    // Find the preempted ticket. At least one P4 should be pushed back to 'queued'
    let queuedP4Count = 0
    for (let i = 1; i <= 5; i++) {
       const t = world.getComponent<TicketComponent>('ticket', `t-${i}`)!
       if (t.status === 'queued') queuedP4Count++
    }
    expect(queuedP4Count).toBe(1) // Exactly 1 P4 was sacrificed for the P1
    expect(alertSpy).toHaveBeenCalledWith('system:alert', expect.objectContaining({
      message: expect.stringContaining('Ticket Preempted'),
      severity: 'warning'
    }))

    // The P1 ticket should be dispatched but have a travel delay (15s).
    // So its elapsedSeconds should NOT advance yet!
    const p1 = world.getComponent<TicketComponent>('ticket', 't-6')!
    expect(p1.status).toBe('dispatched')
    expect(p1.elapsedSeconds).toBe(0) // Travel time prevents work from starting

    // Wait out the travel time (15s)
    system.update(14.0) // 1s + 14s = 15s total travel
    expect(p1.elapsedSeconds).toBe(0) // Still travelling

    // Next tick it should arrive and start working
    system.update(1.0)
    expect(p1.status).toBe('arrived')
    expect(p1.elapsedSeconds).toBe(1.0)
  })

  it('should complete ticket and repair entity components', () => {
    const world = new World()
    const system = new TicketingSystem(world)
    const alertSpy = vi.fn()
    world.eventBus.publish = alertSpy

    const nodeId = 'node-1'
    const ticketId = 't-complete'

    world.registerEntity(nodeId)
    world.addComponent('transform', {
      entityId: nodeId,
      degradation: 100,
      healthStatus: 'critical',
      maintenanceMode: true
    } as TransformComponent)
    world.addComponent('power', {
      entityId: nodeId,
      breakerTripped: true,
      overloadSeconds: 50
    } as PowerComponent)

    world.registerEntity(ticketId)
    world.addComponent('ticket', {
      entityId: ticketId,
      ticketId: ticketId,
      targetNodeId: nodeId,
      type: 'power',
      priority: 'P2',
      status: 'repairing',
      elapsedSeconds: 9.0,
      totalSeconds: 10.0
    } as TicketComponent)

    // In the test, elapsedSeconds is already 9.0, meaning it's already dispatched and travelling is done (since it's repairing).
    // TickelingSystem will try to add travelRemaining = 15.0 if it transitions from queued.
    // Since it's already 'repairing', it bypasses the queued logic and just ticks!
    // Advance by 1.5 seconds to push it over 10.0
    system.update(1.5)

    // Ticket component should be removed from ECS upon completion
    const ticket = world.getComponent<TicketComponent>('ticket', ticketId)
    expect(ticket).toBeUndefined()

    // Entity should be repaired
    const transform = world.getComponent<TransformComponent>('transform', nodeId)!
    expect(transform.degradation).toBe(0)
    expect(transform.healthStatus).toBe('nominal')
    expect(transform.maintenanceMode).toBe(false)

    const power = world.getComponent<PowerComponent>('power', nodeId)!
    expect(power.breakerTripped).toBe(false)
    expect(power.overloadSeconds).toBe(0)

    // Event bus should be called
    expect(alertSpy).toHaveBeenCalledWith('ticket:completed', expect.objectContaining({ ticketId }))
  })
})
