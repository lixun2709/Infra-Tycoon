import type { StorageComponent, ComponentMap } from '../../types'
import { SANAggregator } from './SANAggregator'

export class ReplicationManager {
  /**
   * Processes active data replication sync loop syncing data transfer across available bandwidth.
   */
  public static processReplication(
    entities: readonly string[],
    storageMap: ComponentMap<StorageComponent>,
    adjMap: Map<string, string[]>,
    bwMap: Map<string, number>,
    dt: number
  ) {
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
          const bw = SANAggregator.findPathBandwidth(srcId, id, adjMap, bwMap)
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
  }
}
