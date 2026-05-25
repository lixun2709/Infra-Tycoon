import { System } from '../System'
import type { StorageComponent, PowerComponent, TransformComponent, ApplicationComponent, ThermalComponent, ConnectionComponent } from '../types'

/**
 * StorageSystem
 * ECS implementation of datacenter storage physical mechanics.
 * Models RAID redundancy states, capacity SAS/FC fabric aggregation, IOPS queuing, and drive wearing.
 */
export class StorageSystem extends System {
  // Pre-allocated object pools to prevent GC spikes
  private adjMap = new Map<string, string[]>()
  private bwMap = new Map<string, number>()
  
  // BFS pools
  private pathVisited = new Set<string>()
  private pathQueue: { node: string; minBw: number }[] = []
  
  private lunVisited = new Set<string>()
  private lunQueue: string[] = []
  private connectedShelves: string[] = []

  public update(dt: number) {
    const storageMap = this.world.getComponentMap<StorageComponent>('storage')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const appMap = this.world.getComponentMap<ApplicationComponent>('application')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')

    const entities = this.world.getEntitiesWith(['storage', 'transform'])

    // Build Adjacency Map in O(N) using zero-allocation arrays
    this.adjMap.clear()
    this.bwMap.clear()

    if (connectionMap) {
      connectionMap.forEach((c) => {
        if (c.status === 'blocked') return
        const u = c.startNodeId
        const v = c.endNodeId
        
        let uArr = this.adjMap.get(u)
        if (!uArr) { uArr = []; this.adjMap.set(u, uArr) }
        uArr.push(v)

        let vArr = this.adjMap.get(v)
        if (!vArr) { vArr = []; this.adjMap.set(v, vArr) }
        vArr.push(u)

        // Store bandwidth symmetrically (startNode_endNode)
        const bw = c.bandwidthGbps ?? 10.0
        this.bwMap.set(`${u}_${v}`, bw)
        this.bwMap.set(`${v}_${u}`, bw)
      })
    }

    // 0. Maintain and reset baseline storage capacities for controllers/shelves
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      if (storage.baseTotalStorageTB === undefined) {
        storage.baseTotalStorageTB = storage.totalStorageTB
        storage.baseUsedStorageTB = storage.usedStorageTB
        storage.baseIoPSLimit = storage.ioPSLimit
      }
      if (storage.deduplicationEnabled === undefined) storage.deduplicationEnabled = false
      if (storage.compressionEnabled === undefined) storage.compressionEnabled = false
      if (storage.deduplicationRatio === undefined) storage.deduplicationRatio = 2.4
      if (storage.compressionRatio === undefined) storage.compressionRatio = 1.5
      if (storage.physicalUsedStorageTB === undefined) storage.physicalUsedStorageTB = storage.usedStorageTB
      if (storage.writeAmplificationFactor === undefined) {
        const raid = storage.raidLevel
        if (raid === 'RAID6') storage.writeAmplificationFactor = 6.0
        else if (raid === 'RAID5') storage.writeAmplificationFactor = 4.0
        else if (raid === 'RAID1' || raid === 'RAID10') storage.writeAmplificationFactor = 2.0
        else storage.writeAmplificationFactor = 1.0
      }
    })

    // Helper to compute path bottleneck bandwidth (in Gbps) using object pools
    const findPathBandwidth = (start: string, end: string): number => {
      if (start === end) return 100.0
      
      this.pathVisited.clear()
      this.pathQueue.length = 0
      
      this.pathQueue.push({ node: start, minBw: Infinity })
      this.pathVisited.add(start)

      let queueIndex = 0
      while (queueIndex < this.pathQueue.length) {
        const { node, minBw } = this.pathQueue[queueIndex++]
        if (node === end) return minBw

        const neighbors = this.adjMap.get(node) || []
        for (let i = 0; i < neighbors.length; i++) {
          const neighbor = neighbors[i]
          if (!this.pathVisited.has(neighbor)) {
            this.pathVisited.add(neighbor)
            const edgeBw = this.bwMap.get(`${node}_${neighbor}`) ?? 10.0
            this.pathQueue.push({ node: neighbor, minBw: Math.min(minBw, edgeBw) })
          }
        }
      }
      return 0.0
    }

    // 1. Process LUN & SAN Aggregation (Disk Shelf SAS/FC Cabling to SAN Controller)
    entities.forEach(controllerId => {
      const controllerTransform = transformMap.get(controllerId)!
      const controllerStorage = storageMap.get(controllerId)!
      if (controllerTransform.type !== 'storage' || controllerId.includes('shelf')) {
        return
      }

      // BFS to find all active connected disk shelves cabled to this controller
      this.lunVisited.clear()
      this.lunQueue.length = 0
      this.connectedShelves.length = 0

      this.lunQueue.push(controllerId)
      this.lunVisited.add(controllerId)

      let queueIndex = 0
      while (queueIndex < this.lunQueue.length) {
        const u = this.lunQueue[queueIndex++]
        
        const neighbors = this.adjMap.get(u) || []
        for (let i = 0; i < neighbors.length; i++) {
          const neighbor = neighbors[i]
          if (!this.lunVisited.has(neighbor)) {
            this.lunVisited.add(neighbor)
            const neighborTransform = transformMap.get(neighbor)
            if (neighborTransform) {
              if (neighborTransform.type === 'storage' && neighbor.includes('shelf')) {
                this.connectedShelves.push(neighbor)
              }
              if (neighborTransform.type === 'network' || neighborTransform.type === 'storage') {
                this.lunQueue.push(neighbor)
              }
            }
          }
        }
      }

      // Aggregate capacity and IOPS from cabled shelves to this controller
      let aggTotal = controllerStorage.baseTotalStorageTB ?? controllerStorage.totalStorageTB
      let aggUsed = controllerStorage.baseUsedStorageTB ?? controllerStorage.usedStorageTB
      let aggLimit = controllerStorage.baseIoPSLimit ?? controllerStorage.ioPSLimit

      for (let i = 0; i < this.connectedShelves.length; i++) {
        const shelfId = this.connectedShelves[i]
        const shelfStorage = storageMap.get(shelfId)
        if (shelfStorage) {
          aggTotal += shelfStorage.totalStorageTB
          aggUsed += shelfStorage.usedStorageTB
          
          // Cap shelf contribution based on path bandwidth (2000 IOPS per 1 Gbps)
          const pathBw = findPathBandwidth(shelfId, controllerId)
          const maxContributedIoPS = Math.floor(pathBw * 2000)
          const cappedShelfIoPS = Math.min(shelfStorage.ioPSLimit, maxContributedIoPS)
          
          aggLimit += cappedShelfIoPS
        }
      }

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

      // RAID-aware Write Amplification Factor (WAF)
      const raid = storage.raidLevel
      let waf = 1.0
      if (raid === 'RAID5') waf = 4.0
      else if (raid === 'RAID6') waf = 6.0
      else if (raid === 'RAID1' || raid === 'RAID10') waf = 2.0
      storage.writeAmplificationFactor = waf

      // Drive wear rate is proportional to active I/O loads, tier multipliers, and WAF
      let tierWearMult = 1.0
      if (storage.tier === 'nvme') tierWearMult = 0.2
      else if (storage.tier === 'ssd') tierWearMult = 0.5

      const wearIntensity = storage.ioPSUsed > 0 ? (storage.ioPSUsed / storage.ioPSLimit) : 0.05
      const activeWaf = wearIntensity > 0.05 ? waf : 1.0
      const wearIncrement = Math.max(0.001, wearIntensity * 0.1) * dt * tierWearMult * activeWaf
      storage.driveDegradation = Math.min(100, storage.driveDegradation + wearIncrement)

      // Disk Failure triggers
      if (storage.driveDegradation >= 99.0 && storage.storageStatus !== 'failed') {
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

      // Dynamic Rebuild mechanics
      if (storage.storageStatus === 'rebuilding') {
        let rebuildIncrement = 0
        if (storage.tier === undefined) {
          // Backward compatibility default rebuild rate
          rebuildIncrement = 10.0 * dt
        } else {
          const baseRebuildRate = 5.0 // percent per second
          let tierSpeedMult = 0.5
          if (storage.tier === 'nvme') tierSpeedMult = 3.0
          else if (storage.tier === 'ssd') tierSpeedMult = 1.5

          let raidRebuildPenalty = 1.0
          if (storage.raidLevel === 'RAID6') raidRebuildPenalty = 0.5
          else if (storage.raidLevel === 'RAID5') raidRebuildPenalty = 0.7

          rebuildIncrement = baseRebuildRate * tierSpeedMult * raidRebuildPenalty * dt
        }
        storage.rebuildProgress = Math.min(100, (storage.rebuildProgress ?? 0) + rebuildIncrement)
        
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
      
      // Calculate physical space used after compression and deduplication
      const dedup = storage.deduplicationEnabled ? (storage.deduplicationRatio ?? 2.4) : 1.0
      const comp = storage.compressionEnabled ? (storage.compressionRatio ?? 1.5) : 1.0
      storage.physicalUsedStorageTB = Number((storage.usedStorageTB / (dedup * comp)).toFixed(3))

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

    // Process deduplication/compression IOPS overhead
    entities.forEach(id => {
      const storage = storageMap.get(id)!
      if (storage.ioPSUsed > 0) {
        let overhead = 0.0
        if (storage.deduplicationEnabled) overhead += 0.15
        if (storage.compressionEnabled) overhead += 0.10
        if (overhead > 0) {
          storage.ioPSUsed = Math.floor(storage.ioPSUsed * (1.0 + overhead))
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
