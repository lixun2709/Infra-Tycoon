import { System } from '../System'
import type { StorageComponent, PowerComponent, TransformComponent, ApplicationComponent, ThermalComponent, ConnectionComponent } from '../types'

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
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')

    const entities = this.world.getEntitiesWith(['storage', 'transform'])
    const activeConnections = Array.from(connectionMap?.values() || []).filter(c => c.status !== 'blocked')

    // 0. Maintain and reset baseline storage capacities for controllers/shelves
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      if (storage.baseTotalStorageTB === undefined) {
        storage.baseTotalStorageTB = storage.totalStorageTB
        storage.baseUsedStorageTB = storage.usedStorageTB
        storage.baseIoPSLimit = storage.ioPSLimit
      }
    })

    // 1. Process LUN & SAN Aggregation (Disk Shelf SAS/FC Cabling to SAN Controller)
    entities.forEach(controllerId => {
      const controllerTransform = transformMap.get(controllerId)!
      const controllerStorage = storageMap.get(controllerId)!
      if (controllerTransform.type !== 'storage' || controllerId.includes('shelf')) {
        return
      }

      // BFS to find all active connected disk shelves cabled to this controller
      const queue: string[] = [controllerId]
      const visited = new Set<string>([controllerId])
      const connectedShelves: string[] = []

      while (queue.length > 0) {
        const u = queue.shift()!
        activeConnections.forEach(c => {
          let neighbor: string | null = null
          if (c.startNodeId === u) neighbor = c.endNodeId
          else if (c.endNodeId === u) neighbor = c.startNodeId

          if (neighbor && !visited.has(neighbor)) {
            visited.add(neighbor)
            const neighborTransform = transformMap.get(neighbor)
            if (neighborTransform) {
              if (neighborTransform.type === 'storage' && neighbor.includes('shelf')) {
                connectedShelves.push(neighbor)
              }
              if (neighborTransform.type === 'network' || neighborTransform.type === 'storage') {
                queue.push(neighbor)
              }
            }
          }
        })
      }

      // Aggregate capacity and IOPS from cabled shelves to this controller
      let aggTotal = controllerStorage.baseTotalStorageTB ?? controllerStorage.totalStorageTB
      let aggUsed = controllerStorage.baseUsedStorageTB ?? controllerStorage.usedStorageTB
      let aggLimit = controllerStorage.baseIoPSLimit ?? controllerStorage.ioPSLimit

      connectedShelves.forEach(shelfId => {
        const shelfStorage = storageMap.get(shelfId)
        if (shelfStorage) {
          aggTotal += shelfStorage.totalStorageTB
          aggUsed += shelfStorage.usedStorageTB
          aggLimit += shelfStorage.ioPSLimit
        }
      })

      controllerStorage.totalStorageTB = aggTotal
      controllerStorage.usedStorageTB = aggUsed
      
      if (controllerStorage.storageStatus === 'degraded') {
        if (controllerStorage.raidLevel === 'RAID6') {
          controllerStorage.ioPSLimit = Math.floor(aggLimit * 0.75)
        } else {
          controllerStorage.ioPSLimit = Math.floor(aggLimit * 0.5)
        }
      } else if (controllerStorage.storageStatus === 'highly_degraded') {
        controllerStorage.ioPSLimit = Math.floor(aggLimit * 0.4)
      } else if (controllerStorage.storageStatus === 'failed') {
        controllerStorage.ioPSLimit = 0
      } else {
        controllerStorage.ioPSLimit = aggLimit
      }
    })

    // Helper to compute path bottleneck bandwidth (in Gbps)
    const findPathBandwidth = (start: string, end: string): number => {
      if (start === end) return 100.0
      const queue: { node: string; minBw: number }[] = [{ node: start, minBw: Infinity }]
      const visited = new Set<string>([start])

      while (queue.length > 0) {
        const { node, minBw } = queue.shift()!
        if (node === end) return minBw

        activeConnections.forEach(c => {
          let neighbor: string | null = null
          if (c.startNodeId === node) neighbor = c.endNodeId
          else if (c.endNodeId === node) neighbor = c.startNodeId

          if (neighbor && !visited.has(neighbor)) {
            visited.add(neighbor)
            const edgeBw = c.bandwidthGbps ?? 1.0
            queue.push({ node: neighbor, minBw: Math.min(minBw, edgeBw) })
          }
        })
      }
      return 0.0
    }

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

      // Drive wear rate is proportional to active I/O loads and tier multipliers
      let tierWearMult = 1.0
      if (storage.tier === 'nvme') tierWearMult = 0.2
      else if (storage.tier === 'ssd') tierWearMult = 0.5

      const wearIntensity = storage.ioPSUsed > 0 ? (storage.ioPSUsed / storage.ioPSLimit) : 0.05
      const wearIncrement = Math.max(0.001, wearIntensity * 0.1) * dt * tierWearMult
      storage.driveDegradation = Math.min(100, storage.driveDegradation + wearIncrement)

      // Disk Failure triggers
      if (storage.driveDegradation >= 99.0 && storage.storageStatus !== 'failed') {
        const raid = storage.raidLevel
        storage.driveDegradation = 0.0 // Reset wear on failure

        if (raid === 'RAID0' || raid === 'JBOD') {
          storage.storageStatus = 'failed'
          storage.failedDrives = (storage.failedDrives ?? 0) + 1
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `CRITICAL: Storage Array failure on ${id}. RAID level ${raid} has no tolerance. Data OFFLINE.`,
            severity: 'critical'
          })
        } else if (raid === 'RAID6') {
          storage.failedDrives = (storage.failedDrives ?? 0) + 1
          const base = storage.baseIoPSLimit ?? storage.ioPSLimit
          if (storage.failedDrives === 1) {
            storage.storageStatus = 'degraded'
            storage.ioPSLimit = Math.floor(base * 0.75)
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array degraded on ${id}. RAID level RAID6 operating with 1 failed drive.`,
              severity: 'warning'
            })
          } else if (storage.failedDrives === 2) {
            storage.storageStatus = 'highly_degraded'
            storage.ioPSLimit = Math.floor(base * 0.4)
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array highly degraded on ${id}. RAID level RAID6 operating with 2 failed drives.`,
              severity: 'warning'
            })
          } else {
            storage.storageStatus = 'failed'
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `CRITICAL: Catastrophic storage failure on ${id}. RAID level RAID6 exceeded dual parity limits.`,
              severity: 'critical'
            })
          }
        } else {
          // RAID1, RAID5, RAID10 can tolerate single drive loss
          storage.failedDrives = (storage.failedDrives ?? 0) + 1
          const base = storage.baseIoPSLimit ?? storage.ioPSLimit
          if (storage.failedDrives === 1) {
            storage.storageStatus = 'degraded'
            storage.ioPSLimit = Math.floor(base * 0.5)
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array degraded on ${id}. RAID level ${raid} operating in degraded state.`,
              severity: 'warning'
            })
          } else {
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
          
          if (storage.raidLevel === 'RAID6') {
            storage.ioPSLimit = storage.baseIoPSLimit ? Math.max(storage.ioPSLimit, storage.baseIoPSLimit) : storage.ioPSLimit
            if (storage.failedDrives === 2) {
              storage.ioPSLimit = Math.floor(storage.ioPSLimit / 0.4)
            } else {
              storage.ioPSLimit = Math.floor(storage.ioPSLimit / 0.75)
            }
          } else {
            storage.ioPSLimit = storage.ioPSLimit * 2
          }
          storage.failedDrives = 0
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `INFO: Storage Array rebuild complete on ${id}. Restored to healthy status.`,
            severity: 'info'
          })
        }
      }
    })

    // 3. Active data replication sync loop
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      if (storage.replicationSourceId) {
        const srcId = storage.replicationSourceId
        const srcStorage = storageMap.get(srcId)
        if (srcStorage) {
          const bw = findPathBandwidth(srcId, id)
          if (bw > 0) {
            const syncRate = bw * 2.0 * dt
            storage.replicationProgress = Math.min(100, (storage.replicationProgress ?? 0) + syncRate)
            
            const transferTB = (bw / 8000) * dt
            storage.usedStorageTB = Math.min(srcStorage.usedStorageTB, storage.usedStorageTB + transferTB)

            if (storage.usedStorageTB >= srcStorage.usedStorageTB) {
              storage.replicationProgress = 100
            }
          } else {
            storage.replicationProgress = 0
          }
        }
      }
    })

    // 4. IOPS workload sum & Cascading performance thrashes
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
        thermal.temperature = Math.min(95, thermal.temperature + (3 * dt))
        thermal.isThrottled = true
      }

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
