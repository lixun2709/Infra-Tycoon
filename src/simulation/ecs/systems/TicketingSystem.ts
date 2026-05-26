import type { System } from '../SystemManager'
import type { World } from '../World'
import type { 
  TicketComponent,
  TransformComponent,
  PowerComponent,
  ThermalComponent,
  StorageComponent,
  ConnectionComponent
} from '../types'

export class TicketingSystem implements System {
  private maxTechnicians = 5

  public update(world: World, dt: number): void {
    const ticketComponents = world.getComponents<TicketComponent>('TicketComponent')
    if (!ticketComponents) return

    let activeTickets = 0
    // Count active tickets (not completed, not queued)
    ticketComponents.forEach((ticket) => {
      if (ticket.status !== 'completed' && ticket.status !== 'queued') {
        activeTickets++
      }
    })

    ticketComponents.forEach((ticket, entityId) => {
      // Advance ticket progress deterministically based on dt
      if (ticket.status !== 'completed') {
        // If it's queued or brand new, check if we have technician capacity
        if (ticket.status === 'queued' || ticket.elapsedSeconds === 0) {
          if (activeTickets >= this.maxTechnicians) {
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
          this.repairEntity(world, entityId, ticket.type)
          
          // Emit completion event for the main thread to pick up
          world.publish('ticket:completed', { entityId, ticketId: ticket.ticketId })
          
          // Clean up the ticket component so we don't process it anymore
          world.removeComponent(entityId, 'TicketComponent')
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

  private repairEntity(world: World, entityId: string, type: string) {
    const transform = world.getComponent<TransformComponent>(entityId, 'TransformComponent')
    
    if (transform) {
      transform.degradation = 0
      transform.healthStatus = 'nominal'
      transform.maintenanceMode = false
    }

    if (type === 'drive') {
      const storage = world.getComponent<StorageComponent>(entityId, 'StorageComponent')
      if (storage) {
        storage.driveDegradation = 0
        storage.storageStatus = 'healthy'
        storage.failedDrives = 0
      }
    } else if (type === 'cpu' || type === 'motherboard') {
      const thermal = world.getComponent<ThermalComponent>(entityId, 'ThermalComponent')
      if (thermal) {
        thermal.isThrottled = false
        thermal.temperature = 45 // baseline
      }
    } else if (type === 'psu' || type === 'power') {
      const power = world.getComponent<PowerComponent>(entityId, 'PowerComponent')
      if (power) {
        power.breakerTripped = false
        power.overloadSeconds = 0
      }
    } else if (type === 'network') {
      const connection = world.getComponent<ConnectionComponent>(entityId, 'ConnectionComponent')
      if (connection) {
        connection.status = 'active'
        connection.packetLoss = 0
      }
    }
  }
}
