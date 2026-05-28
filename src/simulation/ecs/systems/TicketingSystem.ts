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

  public update(dt: number): void {
    const ticketComponents = this.world.getComponentMap<TicketComponent>('TicketComponent')
    if (!ticketComponents) return

    let activeTickets = 0
    // Count active tickets (not completed, not queued)
    ticketComponents.forEach((ticket: TicketComponent) => {
      if (ticket.status !== 'completed' && ticket.status !== 'queued') {
        activeTickets++
      }
    })

    // Pre-sort tickets by priority (P1 > P2 > P3 > P4 > undefined) and deterministically by ID
    const sortedTickets = Array.from(ticketComponents.entries()).sort((a: [string, TicketComponent], b: [string, TicketComponent]) => {
      const pA = a[1].priority || 'P4'
      const pB = b[1].priority || 'P4'
      if (pA < pB) return -1
      if (pA > pB) return 1
      return a[0].localeCompare(b[0])
    })

    sortedTickets.forEach(([entityId, ticket]: [string, TicketComponent]) => {
      // Advance ticket progress deterministically based on dt
      if (ticket.status !== 'completed') {
        // If it's queued or brand new, check if we have technician capacity
        if (ticket.status === 'queued' || ticket.elapsedSeconds === 0) {
          // P1 tickets override maxTechnicians limits slightly (up to 2x capacity) in emergencies
          const currentLimit = ticket.priority === 'P1' ? this.maxTechnicians * 2 : this.maxTechnicians
          
          if (activeTickets >= currentLimit) {
            ticket.status = 'queued'
            return // Skip advancing dt, the ticket is waiting for a technician
          } else {
            // A technician picked it up!
            activeTickets++
            if (ticket.status === 'queued') {
               ticket.status = 'dispatched'
            }
          }
        }

        ticket.elapsedSeconds += dt

        if (ticket.elapsedSeconds >= ticket.totalSeconds) {
          ticket.status = 'completed'
          this.repairEntity(ticket.targetNodeId, ticket.type)
          
          // Emit completion event for the main thread to pick up
          this.world.eventBus.publish('ticket:completed', { entityId, ticketId: ticket.ticketId })
          
          // Clean up the ticket component so we don't process it anymore
          this.world.removeComponent('TicketComponent', entityId)
        } else if (ticket.elapsedSeconds > ticket.totalSeconds * 0.8) {
          ticket.status = 'repairing'
        } else if (ticket.elapsedSeconds > ticket.totalSeconds * 0.2) {
          ticket.status = 'diagnosing'
        } else {
          ticket.status = 'arrived'
        }
      }
    })
  }

  private repairEntity(entityId: string, type: string) {
    const transform = this.world.getComponent<TransformComponent>('TransformComponent', entityId)
    
    if (transform) {
      transform.degradation = 0
      transform.healthStatus = 'nominal'
      transform.maintenanceMode = false
    }

    if (type === 'drive') {
      const storage = this.world.getComponent<StorageComponent>('StorageComponent', entityId)
      if (storage) {
        storage.driveDegradation = 0
        storage.storageStatus = 'healthy'
        storage.failedDrives = 0
      }
    } else if (type === 'cpu' || type === 'motherboard') {
      const thermal = this.world.getComponent<ThermalComponent>('ThermalComponent', entityId)
      if (thermal) {
        thermal.isThrottled = false
        thermal.temperature = 45 // baseline
      }
    } else if (type === 'psu' || type === 'power') {
      const power = this.world.getComponent<PowerComponent>('PowerComponent', entityId)
      if (power) {
        power.breakerTripped = false
        power.overloadSeconds = 0
      }
    } else if (type === 'network') {
      const connection = this.world.getComponent<ConnectionComponent>('ConnectionComponent', entityId)
      if (connection) {
        connection.status = 'active'
        connection.packetLoss = 0
      }
    }
  }
}
