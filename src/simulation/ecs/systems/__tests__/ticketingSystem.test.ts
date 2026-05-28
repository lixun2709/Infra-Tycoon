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

    // Tick the system
    system.update(1.0)

    // P1 ticket should definitely be dispatched
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
    expect(p4TicketDispatched.status).toBe('dispatched')

    const p4TicketQueued = world.getComponent<TicketComponent>('ticket', 't-5')!
    expect(p4TicketQueued.status).toBe('queued')
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
