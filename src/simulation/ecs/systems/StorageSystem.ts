import { System } from '../System'
import type { StorageComponent, PowerComponent, TransformComponent, ApplicationComponent, ThermalComponent } from '../types'

/**
 * StorageSystem
 * ECS implementation of datacenter storage physical mechanics.
 * Models RAID redundancy states, capacity SAS/FC fabric aggregation, IOPS queuing, and drive wearing.
 */
export class StorageSystem extends System {
  public update(dt: number) {
    const storageMap = this.world.getComponentMap<StorageComponent>('storage')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const appMap = this.world.getComponentMap<ApplicationComponent>('application')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')

    const entities = this.world.getEntitiesWith(['storage', 'transform'])

    // 1. Process LUN & SAN Aggregation (Disk Shelf SAS/FC Cabling to SAN Controller)
    // To remain deterministic, we query transform components for connected topologies.
    // In our simplified ECS model, if a Disk Shelf has a cabled link, it aggregates capacity to its parent/controller.
    entities.forEach(id => {
      const transform = transformMap.get(id)!
      
      // Let's reset cabled additions so we recalculate purely on active connections
      if (transform.type === 'storage' && id.includes('shelf')) {
        // Shelf is capacity expansion, it will be added to its cabled Controller
      }
    });

    // 2. Drive degradation wear and RAID resilience failure machine
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      const power = powerMap.get(id)
      const transform = transformMap.get(id)!

      if (transform.type === 'rack') return

      const isRunning = power?.isPowered ?? false
      if (!isRunning) {
        storage.ioPSUsed = 0
        return
      }

      // Drive wear rate is proportional to active I/O loads
      const wearIntensity = storage.ioPSUsed > 0 ? (storage.ioPSUsed / storage.ioPSLimit) : 0.05
      const wearIncrement = Math.max(0.001, wearIntensity * 0.1) * dt
      storage.driveDegradation = Math.min(100, storage.driveDegradation + wearIncrement)

      // Disk Failure triggers
      if (storage.driveDegradation >= 99.0 && storage.storageStatus !== 'failed') {
        const raid = storage.raidLevel
        if (raid === 'RAID0' || raid === 'JBOD') {
          storage.storageStatus = 'failed'
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: Storage Array failure on ${id}. RAID level ${raid} has no tolerance. Data OFFLINE.`,
            severity: 'critical'
          })
        } else {
          // RAID 1, 5, 10 can tolerate single drive loss
          if (storage.storageStatus === 'healthy') {
            storage.storageStatus = 'degraded'
            // Reduce IOPS capacity by 50% under degraded reconstruction
            storage.ioPSLimit = Math.floor(storage.ioPSLimit * 0.5)
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array degraded on ${id}. RAID level ${raid} operating in degraded state.`,
              severity: 'warning'
            })
          } else if (storage.storageStatus === 'degraded') {
            // Second disk loss leads to total array loss
            storage.storageStatus = 'failed'
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `CRITICAL: Catastrophic storage failure on ${id}. Multiple drive loss exceeded RAID tolerance.`,
              severity: 'critical'
            })
          }
        }
      }

      // Rebuild mechanics
      if (storage.storageStatus === 'rebuilding') {
        storage.rebuildProgress = Math.min(100, storage.rebuildProgress + (10 * dt))
        if (storage.rebuildProgress >= 100) {
          storage.storageStatus = 'healthy'
          storage.rebuildProgress = 0
          // Restore original IOPS limits
          storage.ioPSLimit = storage.ioPSLimit * 2
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `INFO: Storage Array rebuild complete on ${id}. Restored to healthy status.`,
            severity: 'info'
          })
        }
      }
    })

    // 3. IOPS workload sum & Cascading performance thrashes
    const appEntities = this.world.getEntitiesWith(['application'])
    
    // Reset IOPS on all storage elements
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      storage.ioPSUsed = 0
    })

    // Assign IOPS load from running apps to their hosts
    appEntities.forEach(appId => {
      const app = appMap.get(appId)!
      if (app.status !== 'running') return

      // Determine IOPS load based on app categories
      let appIOPS = 100
      if (app.appId === 'postgres') appIOPS = 4000
      else if (app.appId === 'redis') appIOPS = 2000
      else if (app.appId === 'wordpress') appIOPS = 200

      const hostId = app.nodeId
      if (hostId) {
        const storage = storageMap.get(hostId)
        if (storage) {
          storage.ioPSUsed += appIOPS
        }
      }
    })

    // Cascade Storage status and thrashing bottlenecks back to apps
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      const thermal = thermalMap.get(id)

      const isThrashed = storage.ioPSUsed > storage.ioPSLimit
      const isFailed = storage.storageStatus === 'failed'

      if (isThrashed && thermal) {
        // Disk thrashing generates frictional and queuing overhead heat
        thermal.temperature = Math.min(95, thermal.temperature + (3 * dt))
        thermal.isThrottled = true
      }

      // If array is failed, shut down all application services hosted here
      if (isFailed) {
        appEntities.forEach(appId => {
          const app = appMap.get(appId)!
          if (app.nodeId === id) {
            app.status = 'error'
          }
        })
      }
    })
  }
}
