import { System } from '../System'
import type { World } from '../World'
import type { ApplicationComponent, ConnectionComponent, TransformComponent, PowerComponent, ThermalComponent } from '../types'
import { APPLICATION_CATALOG } from '../../../physics/applicationLibrary'

export class AISystem extends System {
  constructor(world: World) {
    super(world)
  }

  update(dt: number) {
    const apps = this.world.getComponentMap<ApplicationComponent>('application')
    const connections = this.world.getComponentMap<ConnectionComponent>('connection')
    const transforms = this.world.getComponentMap<TransformComponent>('transform')
    const powers = this.world.getComponentMap<PowerComponent>('power')
    const thermals = this.world.getComponentMap<ThermalComponent>('thermal')
    
    // Quick lookup for network topology
    // To see if node is connected to an infiniband switch
    const isNodeConnectedToIB = (nodeId: string): boolean => {
      let hasIB = false
      connections.forEach(conn => {
        if (conn.status !== 'active') return
        if (conn.startNodeId === nodeId || conn.endNodeId === nodeId) {
          const remoteId = conn.startNodeId === nodeId ? conn.endNodeId : conn.startNodeId
          const remoteTransform = transforms.get(remoteId)
          if (remoteTransform && remoteTransform.catalogKey === 'INFINIBAND_SWITCH_1U') {
            hasIB = true
          }
        }
      })
      return hasIB
    }

    apps.forEach((app, _entityId) => {
      if (app.status !== 'running') return
      
      const meta = APPLICATION_CATALOG[app.appId]
      if (!meta || meta.category !== 'ai') return
      
      const nodeId = app.nodeId
      const power = powers.get(nodeId)
      const thermal = thermals.get(nodeId)
      const transform = transforms.get(nodeId)

      // Only run if the node is powered on
      if (!power || power.systemState !== 'running' || !transform) return

      // AI models generate massive thermal and power load.
      // High utilization during training is handled by PowerSystem

      // Check Networking
      const hasIB = isNodeConnectedToIB(nodeId)
      
      // Calculate FLOPS
      let baseFlops = meta.requirements.minFLOPS || 100000
      if (transform.catalogKey !== 'H100_AI_NODE_4U') {
        baseFlops *= 0.1 // Generic compute is 10x slower
      }

      if (!hasIB) {
        app.aiStatus = 'stalled'
        baseFlops *= 0.2 // 80% penalty for standard Ethernet RDMA
      } else {
        // Check Thermal Throttling
        if (thermal && thermal.isThrottled) {
          baseFlops *= 0.5 // 50% thermal throttle
          app.aiStatus = 'stalled'
        } else {
          app.aiStatus = 'training'
        }
      }

      // Apply FLOPS
      app.aiFlopsDelivered = baseFlops
      
      // Advance Epochs
      if (!app.aiEpochs) app.aiEpochs = 0
      
      // 100 epochs total, baseFlops determines speed. 
      // Say 100,000 flops takes 100 seconds to finish 100 epochs. (1 epoch / sec)
      const epochsPerSec = baseFlops / 100000
      app.aiEpochs += epochsPerSec * dt
      
      if (app.aiEpochs >= 100) {
        app.aiEpochs = 100
        app.aiStatus = 'completed'
      }

      // Sync back to world (ECS will handle worker sync)
      this.world.addComponent('application', app)
    })
  }
}
