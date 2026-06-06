 
import { System } from '../System'

import type { 
  TicketComponent,
  TransformComponent,
  PowerComponent,
  ThermalComponent,
  StorageComponent,
  ConnectionComponent
} from '../types'

export class TicketingSystem extends System {
  private maxTechnicians = 5
  private cachedTickets: Array<[string, TicketComponent]> = []
  private assignedTechnicians: Map<string, { ticketId: string, siteId?: string, travelRemaining: number }> = new Map()

  public update(dt: number): void {
    const ticketComponents = this.world.getComponentMap<TicketComponent>('ticket')
    if (!ticketComponents) return

    let activeTickets = 0
    this.cachedTickets.length = 0
    ticketComponents.forEach((ticket: TicketComponent, entityId: string) => {
      this.cachedTickets.push([entityId, ticket])
      if (ticket.status !== 'completed' && ticket.status !== 'queued') {
        activeTickets++
      }
    })

    const transforms = this.world.getComponentMap<TransformComponent>('transform')

    // Pre-sort tickets by priority (P1 > P2 > P3 > P4 > undefined) and deterministically by ID
    this.cachedTickets.sort((a, b) => {
      const pA = a[1].priority || 'P4'
      const pB = b[1].priority || 'P4'
      if (pA < pB) return -1
      if (pA > pB) return 1
      return a[0].localeCompare(b[0])
    })

    for (const [entityId, ticket] of this.cachedTickets) {
      if (ticket.status === 'completed') continue

      // Active Preemption: If this is a P1 and there are no free technicians, suspend a P4 ticket
      const isEmergency = ticket.priority === 'P1'
      if (ticket.status === 'queued' && activeTickets >= this.maxTechnicians && isEmergency) {
        // Find a P4 ticket to preempt
        for (const [otherId, otherTicket] of this.cachedTickets) {
          if (otherTicket.priority === 'P4' && otherTicket.status !== 'completed' && otherTicket.status !== 'queued') {
            // Preempt it!
            otherTicket.status = 'queued'
            activeTickets--
            this.world.eventBus.publish('system:alert', {
              entityId: otherId,
              message: `Ticket Preempted: Technicians diverted to handle P1 emergency.`,
              severity: 'warning'
            })
            break // Just free up 1 slot for now
          }
        }
      }

      if (ticket.status === 'queued') {
        const currentLimit = isEmergency ? this.maxTechnicians * 2 : this.maxTechnicians
        
        if (activeTickets >= currentLimit) {
          ticket.status = 'queued'
          continue
        } else {
          // A technician picked it up!
          activeTickets++
          if (ticket.status === 'queued') {
             ticket.status = 'dispatched'
          }

          // Assign technician travel
          const targetSiteId = transforms?.get(ticket.targetNodeId)?.siteId
          this.assignedTechnicians.set(ticket.ticketId, {
             ticketId: ticket.ticketId,
             siteId: targetSiteId,
             travelRemaining: 15.0 // Base travel time 15s across sites
          })
        }
      }

      // Check travel time
      const assignment = this.assignedTechnicians.get(ticket.ticketId)
      let effectiveDt = dt
      if (assignment && assignment.travelRemaining > 0) {
         if (assignment.travelRemaining > effectiveDt) {
           assignment.travelRemaining -= effectiveDt
           ticket.status = 'dispatched'
           continue // Still travelling, do not advance elapsedSeconds
         } else {
           effectiveDt -= assignment.travelRemaining
           assignment.travelRemaining = 0
         }
      }

      ticket.elapsedSeconds += effectiveDt

      if (ticket.elapsedSeconds >= ticket.totalSeconds) {
        ticket.status = 'completed'
        this.repairEntity(ticket.targetNodeId, ticket.type)
        
        this.assignedTechnicians.delete(ticket.ticketId)
        
        // Emit completion event for the main thread to pick up
        this.world.eventBus.publish('ticket:completed', { entityId, ticketId: ticket.ticketId })
        
        // Clean up the ticket component so we don't process it anymore
        this.world.removeComponent('ticket', entityId)
      } else if (ticket.elapsedSeconds > ticket.totalSeconds * 0.8) {
        ticket.status = 'repairing'
      } else if (ticket.elapsedSeconds > ticket.totalSeconds * 0.2) {
        ticket.status = 'diagnosing'
      } else {
        ticket.status = 'arrived'
      }
    }
  }

  private repairEntity(entityId: string, type: string) {
    const transform = this.world.getComponent<TransformComponent>('transform', entityId)
    
    if (transform) {
      transform.degradation = 0
      transform.healthStatus = 'nominal'
      transform.maintenanceMode = false
    }

    if (type === 'drive') {
      const storage = this.world.getComponent<StorageComponent>('storage', entityId)
      if (storage) {
        storage.driveDegradation = 0
        storage.storageStatus = 'healthy'
        storage.failedDrives = 0
      }
    } else if (type === 'cpu' || type === 'motherboard') {
      const thermal = this.world.getComponent<ThermalComponent>('thermal', entityId)
      if (thermal) {
        thermal.isThrottled = false
        thermal.temperature = 45 // baseline
      }
    } else if (type === 'psu' || type === 'power') {
      const power = this.world.getComponent<PowerComponent>('power', entityId)
      if (power) {
        power.breakerTripped = false
        power.overloadSeconds = 0
      }
    } else if (type === 'network') {
      const connection = this.world.getComponent<ConnectionComponent>('connection', entityId)
      if (connection) {
        connection.status = 'active'
        connection.packetLoss = 0
      }
    }
  }
}

