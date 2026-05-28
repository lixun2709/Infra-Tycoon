import { System } from '../System'
import type { World } from '../World'
import type { 
  IncidentComponent,
  TransformComponent,
  PowerComponent
} from '../types'

export class IncidentSystem extends System {
  public update(dt: number): void {
    // 1. Process Active Incidents
    const incidentComponents = this.world.getComponentMap<IncidentComponent>('incident')
    if (incidentComponents) {
      incidentComponents.forEach((incident, _entityId) => {
        if (incident.isResolved) return

        incident.elapsedSeconds += dt

        // Drill specific execution
        if (incident.type === 'drill') {
          this.executeDrill(this.world, incident, dt)
        }

        // Check resolution conditions implicitly based on node states
        const allResolved = incident.affectedNodes.length > 0 ? incident.affectedNodes.every(nodeId => this.isNodeHealthy(this.world, nodeId)) : false
        
        const rtoTarget = incident.rtoTargetSeconds || 300 // Fallback 5-minute RTO

        if (incident.elapsedSeconds > rtoTarget && !allResolved) {
          // RTO violation
          this.world.eventBus.publish('incident:rto_violation', { incidentId: incident.incidentId })
          
          if (!incident.hasAlertedRto) {
            incident.hasAlertedRto = true
            this.world.eventBus.publish('system:alert', {
              entityId: incident.incidentId,
              message: `CRITICAL SLA VIOLATION: Target RTO of ${rtoTarget}s missed for incident ${incident.type}. CASCADE FAILURE TRIGGERED.`,
              severity: 'error'
            })
            
            this.triggerCascadeFailure(this.world, incident)
          }
        }

        if (allResolved && incident.elapsedSeconds > 10) { // minimum 10s evaluation
          incident.isResolved = true
          this.world.eventBus.publish('incident:resolved', { incidentId: incident.incidentId })
          this.world.eventBus.publish('system:alert', {
             entityId: incident.incidentId,
             message: `DR Drill PASSED: Resolved in ${Math.round(incident.elapsedSeconds)}s.`,
             severity: 'success'
          })
        }
      })
    }

    // 2. Anomaly Detection (Create Incidents)
    this.detectAnomalies(this.world)
  }

  private executeDrill(world: World, incident: IncidentComponent, _dt: number) {
    // In a DR Drill, we simulate a Site Isolation (Dark Site) scenario.
    // Instead of randomly pulling power, we isolate all nodes matching the target siteId from the network.
    
    // Drill starts: isolate the site.
    // Drill ends (resolved): reconnect the site.
    
    const transforms = world.getComponentMap<TransformComponent>('transform')
    if (!transforms) return
    
    // We expect the incident to have an affected siteId. If not, fallback to isolating affectedNodes.
    const targetSiteId = incident.siteId
    
    if (targetSiteId) {
      const storageMap = world.getComponentMap<import('../types').StorageComponent>('storage')

      transforms.forEach((transform: TransformComponent, nodeId: string) => {
        if (transform.siteId === targetSiteId) {
          // Check storage replication for RPO
          if (storageMap && incident.elapsedSeconds < 10) {
            const storage = storageMap.get(nodeId)
            if (storage && !storage.replicationSourceId) {
              // No replication configured, RPO violated instantly
              if (incident.rpoTargetSeconds !== undefined) {
                 world.eventBus.publish('incident:rpo_violation', { incidentId: incident.incidentId })
              }
            }
          }

          // Keep power on but blackhole network
          if (incident.elapsedSeconds < 10) {
            transform.isBlackholed = true
          } else if (incident.isResolved) {
            transform.isBlackholed = false
          }
        }
      })

      // Enforce RPO failure
      if (incident.rpoTargetSeconds !== undefined && incident.elapsedSeconds > incident.rpoTargetSeconds && !incident.isResolved) {
         incident.isResolved = true
         world.eventBus.publish('system:alert', {
            entityId: incident.incidentId,
            message: `DR Drill FAILED: RPO Target of ${incident.rpoTargetSeconds}s violated (Storage sync lost or split-brain).`,
            severity: 'error'
         })
      }
    } else {
      // Legacy node-based drill fallback
      incident.affectedNodes.forEach(nodeId => {
        const transform = world.getComponent<TransformComponent>('transform', nodeId)
        if (transform && incident.elapsedSeconds < 10) {
           transform.isBlackholed = true
        } else if (transform && incident.isResolved) {
           transform.isBlackholed = false
        }
      })
    }
  }

  private isNodeHealthy(world: World, nodeId: string): boolean {
    const transform = world.getComponent<TransformComponent>('transform', nodeId)
    const power = world.getComponent<PowerComponent>('power', nodeId)
    
    if (transform && transform.healthStatus !== 'nominal') return false
    if (power && !power.isPowered) return false
    
    return true
  }

  private detectAnomalies(world: World) {
    // Basic detection algorithm for massive failures across the facility
    const transforms = world.getComponentMap<TransformComponent>('transform')
    if (!transforms) return

    let failedNodesCount = 0
    let lastSiteId = ''
    let detectedRootCause = 'Unknown'
    
    transforms.forEach((t: TransformComponent, entityId: string) => {
      if (t.healthStatus === 'critical' || t.degradation && t.degradation > 0.8) {
        failedNodesCount++
        lastSiteId = t.siteId

        const power = world.getComponent<PowerComponent>('power', entityId)
        const thermal = world.getComponent<import('../types').ThermalComponent>('thermal', entityId)
        
        if (power && power.breakerTripped) detectedRootCause = 'Rack Power Overload'
        else if (thermal && thermal.temperature > 85) detectedRootCause = 'Thermal Runaway'
        else if (detectedRootCause === 'Unknown') detectedRootCause = 'Hardware Degradation'
      }

      // Chaos Engineering: Spontaneous Anomalies (0.001% chance per node per tick)
      if (Math.random() < 0.00001 && t.healthStatus === 'nominal') {
        this.spawnChaosIncident(world, entityId)
      }
    })

    const securityComponents = world.getComponentMap<import('../types').SecurityComponent>('SecurityComponent')
    let lockedNodesCount = 0
    let lastLockedSiteId = ''
    if (securityComponents) {
      securityComponents.forEach((sec, entityId) => {
        if (sec.infectionState === 'locked') {
           lockedNodesCount++
           const t = transforms.get(entityId)
           if (t) lastLockedSiteId = t.siteId
        }
      })
    }

    // If more than 5 nodes are heavily degraded or failed, trigger a power/thermal outage incident
    // We would need to deduplicate so we don't spawn thousands of incidents.
    if (failedNodesCount > 5) {
        const activeIncidents = world.getComponentMap<IncidentComponent>('IncidentComponent')
        let alreadyTracked = false
        if (activeIncidents) {
          activeIncidents.forEach((inc: IncidentComponent) => {
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
            type: detectedRootCause === 'Thermal Runaway' ? 'thermal_runaway' : 'power_outage',
            severity: 'high',
            rootCause: detectedRootCause,
            affectedNodes: [],
            elapsedSeconds: 0,
            isResolved: false,
            siteId: lastSiteId
          }
          world.registerEntity(incidentId)
          world.addComponent('IncidentComponent', newIncident)
          world.eventBus.publish('incident:created', { incidentId, type: newIncident.type, siteId: lastSiteId })
        }
    }

    if (lockedNodesCount >= 2) {
      const activeIncidents = world.getComponentMap<IncidentComponent>('IncidentComponent')
      let alreadyTracked = false
      if (activeIncidents) {
        activeIncidents.forEach((inc: IncidentComponent) => {
          if (!inc.isResolved && inc.type === 'ransomware') {
            alreadyTracked = true
          }
        })
      }

      if (!alreadyTracked) {
        const incidentId = `inc-rw-${Date.now()}`
        const newIncident: IncidentComponent = {
          entityId: incidentId,
          incidentId,
          type: 'ransomware',
          severity: 'critical',
          rootCause: 'Malware Exposure',
          affectedNodes: [],
          elapsedSeconds: 0,
          isResolved: false,
          siteId: lastLockedSiteId
        }
        world.registerEntity(incidentId)
        world.addComponent('IncidentComponent', newIncident)
        world.eventBus.publish('incident:created', { incidentId, type: newIncident.type, siteId: lastLockedSiteId })
      }
    }
  }

  private spawnChaosIncident(world: World, targetNodeId: string) {
    const activeIncidents = world.getComponentMap<IncidentComponent>('IncidentComponent')
    let activeCount = 0
    if (activeIncidents) {
      activeIncidents.forEach((inc: IncidentComponent) => { if (!inc.isResolved) activeCount++ })
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

  private triggerCascadeFailure(world: World, sourceIncident: IncidentComponent) {
    const transforms = world.getComponentMap<TransformComponent>('TransformComponent')
    if (!transforms) return

    // Find a healthy node in the same site, or any healthy node to break
    let cascadeTarget: string | null = null
    const firstAffectedNode = sourceIncident.affectedNodes[0]
    const sourceSiteId = sourceIncident.siteId || (firstAffectedNode ? transforms.get(firstAffectedNode)?.siteId : null)

    transforms.forEach((t: TransformComponent, entityId: string) => {
      if (t.healthStatus === 'nominal' && !sourceIncident.affectedNodes.includes(entityId)) {
        if (!cascadeTarget || (sourceSiteId && t.siteId === sourceSiteId && Math.random() > 0.5)) {
          cascadeTarget = entityId
        }
      }
    })

    if (cascadeTarget) {
      const targetTransform = transforms.get(cascadeTarget)
      if (targetTransform) {
        targetTransform.healthStatus = 'critical'
        targetTransform.degradation = 1.0 // Permanent catastrophic fatigue
        
        world.eventBus.publish('system:alert', {
          entityId: cascadeTarget,
          message: `Cascade Hardware Failure: Collateral damage due to unresolved ${sourceIncident.type} incident!`,
          severity: 'critical'
        })
      }
    }
  }
}
