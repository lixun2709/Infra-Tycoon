import { System } from '../System'
import type { StorageComponent, PowerComponent, TransformComponent, ApplicationComponent, ThermalComponent, ConnectionComponent } from '../types'
import { SANAggregator } from './storage/SANAggregator'
import { RAIDManager } from './storage/RAIDManager'
import { ReplicationManager } from './storage/ReplicationManager'
import { IOPSCalculator } from './storage/IOPSCalculator'

/**
 * StorageSystem
 * ECS implementation of datacenter storage physical mechanics.
 * Orchestrates RAID redundancy states, capacity SAS/FC fabric aggregation, 
 * IOPS queuing, and drive wearing via specialized modular components.
 */
export class StorageSystem extends System {
  // Pre-allocated object pools to prevent GC spikes
  private adjMap = new Map<string, string[]>()
  private bwMap = new Map<string, number>()

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

    // 1. Process LUN & SAN Aggregation (Disk Shelf SAS/FC Cabling to SAN Controller)
    SANAggregator.processSANAggregation(entities, storageMap, transformMap, this.adjMap, this.bwMap)

    // 2. Drive degradation wear and RAID resilience failure machine
    RAIDManager.processRAIDStatus(entities, storageMap, powerMap, transformMap, dt, this.world.eventBus)

    // 3. Active data replication sync loop
    ReplicationManager.processReplication(entities, storageMap, this.adjMap, this.bwMap, dt)

    // 4. IOPS workload sum & Cascading performance thrashes
    const appEntities = this.world.getEntitiesWith(['application'])
    IOPSCalculator.processIOPSAndThrashing(entities, appEntities, storageMap, appMap, thermalMap, dt)
  }
}
