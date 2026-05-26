import type { StorageComponent, TransformComponent, ComponentMap } from '../../types'

export class SANAggregator {
  // BFS pools
  private static pathVisited = new Set<string>()
  private static pathQueueNodes: string[] = []
  private static pathQueueBws: number[] = []
  private static lunVisited = new Set<string>()
  private static lunQueue: string[] = []
  private static connectedShelves: string[] = []

  /**
   * Helper to compute path bottleneck bandwidth (in Gbps) using object pools
   */
  public static findPathBandwidth(
    start: string, 
    end: string,
    adjMap: Map<string, string[]>,
    bwMap: Map<string, number>
  ): number {
    if (start === end) return 100.0
    
    this.pathVisited.clear()
    this.pathQueueNodes.length = 0
    this.pathQueueBws.length = 0
    
    this.pathQueueNodes.push(start)
    this.pathQueueBws.push(Infinity)
    this.pathVisited.add(start)

    let queueIndex = 0
    while (queueIndex < this.pathQueueNodes.length) {
      const node = this.pathQueueNodes[queueIndex]!
      const minBw = this.pathQueueBws[queueIndex]!
      queueIndex++
      if (node === end) return minBw

      const neighbors = adjMap.get(node) || []
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i]!
        if (!this.pathVisited.has(neighbor)) {
          this.pathVisited.add(neighbor)
          const edgeBw = bwMap.get(`${node}_${neighbor}`) ?? 10.0
          this.pathQueueNodes.push(neighbor)
          this.pathQueueBws.push(Math.min(minBw, edgeBw))
        }
      }
    }
    return 0.0
  }

  /**
   * Discovers and aggregates capacity and IOPS from cabled disk shelves to their SAN controllers.
   */
  public static processSANAggregation(
    entities: readonly string[],
    storageMap: ComponentMap<StorageComponent>,
    transformMap: ComponentMap<TransformComponent>,
    adjMap: Map<string, string[]>,
    bwMap: Map<string, number>
  ) {
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
        const u = this.lunQueue[queueIndex++]!
        
        const neighbors = adjMap.get(u) || []
        for (let i = 0; i < neighbors.length; i++) {
          const neighbor = neighbors[i]!
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
        const shelfId = this.connectedShelves[i]!
        const shelfStorage = storageMap.get(shelfId)
        if (shelfStorage) {
          aggTotal += shelfStorage.totalStorageTB
          aggUsed += shelfStorage.usedStorageTB
          
          // Cap shelf contribution based on path bandwidth (2000 IOPS per 1 Gbps)
          const pathBw = this.findPathBandwidth(shelfId, controllerId, adjMap, bwMap)
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
  }
}
