import type { System } from '../SystemManager'
import type { World } from '../World'
import type { 
  IncidentComponent,
  TransformComponent,
  PowerComponent,
  ConnectionComponent
} from '../types'

export class IncidentSystem implements System {
  public update(world: World, dt: number): void {
    // 1. Process Active Incidents
    const incidentComponents = world.getComponents<IncidentComponent>('IncidentComponent')
    if (incidentComponents) {
      incidentComponents.forEach((incident, _entityId) => {
        if (incident.isResolved) return

        incident.elapsedSeconds += dt

        // Drill specific execution
        if (incident.type === 'drill') {
          this.executeDrill(world, incident, dt)
        }

        // Check resolution conditions implicitly based on node states
        const allResolved = incident.affectedNodes.every(nodeId => this.isNodeHealthy(world, nodeId))
        
        // If an explicit RTO is given, we check if elapsed passed RTO and penalize if not resolved
        if (incident.rtoTargetSeconds && incident.elapsedSeconds > incident.rtoTargetSeconds && !allResolved) {
          // RTO violation
          world.publish('incident:rto_violation', { incidentId: incident.incidentId })
          
          if (!incident.hasAlertedRto) {
            incident.hasAlertedRto = true
            world.eventBus.publish('system:alert', {
              entityId: incident.incidentId,
              message: `DR Drill FAILED: Target RTO of ${incident.rtoTargetSeconds}s missed for incident ${incident.type}.`,
              severity: 'error'
            })
          }
        }

        if (allResolved && incident.elapsedSeconds > 10) { // minimum 10s evaluation
          incident.isResolved = true
          world.publish('incident:resolved', { incidentId: incident.incidentId })
          world.eventBus.publish('system:alert', {
             entityId: incident.incidentId,
             message: `DR Drill PASSED: Resolved in ${Math.round(incident.elapsedSeconds)}s.`,
             severity: 'success'
          })
        }
      })
    }

    // 2. Anomaly Detection (Create Incidents)
    this.detectAnomalies(world)
  }

  private executeDrill(world: World, incident: IncidentComponent, _dt: number) {
    // In a DR Drill, we actively degrade the affected nodes to force the simulation into failover
    // E.g. pulling power or severing connections.
    incident.affectedNodes.forEach(nodeId => {
      const power = world.getComponent<PowerComponent>(nodeId, 'PowerComponent')
      if (power && power.isPowered && incident.elapsedSeconds < 10) {
        // Initial phase of drill: cut power
        power.isPowered = false
      }

      const connection = world.getComponent<ConnectionComponent>(nodeId, 'ConnectionComponent')
      if (connection && connection.status === 'active' && incident.elapsedSeconds < 10) {
        connection.status = 'blocked'
      }
    })
  }

  private isNodeHealthy(world: World, nodeId: string): boolean {
    const transform = world.getComponent<TransformComponent>(nodeId, 'TransformComponent')
    const power = world.getComponent<PowerComponent>(nodeId, 'PowerComponent')
    
    if (transform && transform.healthStatus !== 'nominal') return false
    if (power && !power.isPowered) return false
    
    return true
  }

  private detectAnomalies(world: World) {
    // Basic detection algorithm for massive failures across the facility
    const transforms = world.getComponents<TransformComponent>('TransformComponent')
    if (!transforms) return

    let failedNodesCount = 0
    let lastSiteId = ''
    
    transforms.forEach((t, entityId) => {
      if (t.healthStatus === 'critical' || t.degradation && t.degradation > 0.8) {
        failedNodesCount++
        lastSiteId = t.siteId
      }

      // Chaos Engineering: Spontaneous Anomalies (0.001% chance per node per tick)
      if (Math.random() < 0.00001 && t.healthStatus === 'nominal') {
        this.spawnChaosIncident(world, entityId)
      }
    })

    // If more than 5 nodes are heavily degraded or failed, trigger a power/thermal outage incident
    // We would need to deduplicate so we don't spawn thousands of incidents.
    if (failedNodesCount > 5) {
      const activeIncidents = world.getComponents<IncidentComponent>('IncidentComponent')
      let alreadyTracked = false
      if (activeIncidents) {
        activeIncidents.forEach(inc => {
          if (!inc.isResolved && (inc.type === 'power_outage' || inc.type === 'thermal_runaway')) {
            alreadyTracked = true
          }
        })
      }

      if (!alreadyTracked) {
        const incidentId = `inc-${Date.now()}`
        const newIncident: IncidentComponent = {
          entityId: incidentId,
          incidentId,
          type: 'power_outage',
          severity: 'high',
          affectedNodes: [],
          elapsedSeconds: 0,
          isResolved: false
        }
        world.addComponent(incidentId, 'IncidentComponent', newIncident)
        world.publish('incident:created', { incidentId, type: newIncident.type, siteId: lastSiteId })
      }
    }
  }

  private spawnChaosIncident(world: World, targetNodeId: string) {
    const activeIncidents = world.getComponents<IncidentComponent>('IncidentComponent')
    let activeCount = 0
    if (activeIncidents) {
      activeIncidents.forEach(inc => { if (!inc.isResolved) activeCount++ })
    }
    
    // Don't overwhelm the player with too many simultaneous chaos events
    if (activeCount >= 3) return

    const incidentId = `chaos-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const typeRoll = Math.random()
    const incidentType = typeRoll > 0.5 ? 'network_outage' : 'thermal_runaway'

    const newIncident: IncidentComponent = {
      entityId: incidentId,
      incidentId,
      type: incidentType,
      severity: 'medium',
      affectedNodes: [targetNodeId],
      elapsedSeconds: 0,
      isResolved: false
    }

    world.registerEntity(incidentId)
    world.addComponent('IncidentComponent', newIncident)

    // Execute the fault immediately
    if (incidentType === 'network_outage') {
      const conn = world.getComponent<import('../types').ConnectionComponent>(targetNodeId, 'ConnectionComponent')
      if (conn) conn.status = 'blocked'
    } else {
      const thermal = world.getComponent<import('../types').ThermalComponent>(targetNodeId, 'ThermalComponent')
      if (thermal) thermal.temperature += 40
    }

    world.eventBus.publish('system:alert', {
      entityId: targetNodeId,
      message: `Chaos Event: Spontaneous ${incidentType.replace('_', ' ')} detected on node.`,
      severity: 'warning'
    })
  }
}
