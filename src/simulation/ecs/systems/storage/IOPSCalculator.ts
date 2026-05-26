import type { StorageComponent, ApplicationComponent, ThermalComponent } from '../types'
import { ComponentMap } from '../ComponentMap'

export class IOPSCalculator {
  /**
   * Assigns IOPS load from running apps to storage hosts, processes deduplication/compression overhead,
   * and handles cascading thermal thrashing.
   */
  public static processIOPSAndThrashing(
    storageEntities: string[],
    appEntities: string[],
    storageMap: ComponentMap<StorageComponent>,
    appMap: ComponentMap<ApplicationComponent>,
    thermalMap: ComponentMap<ThermalComponent>,
    dt: number
  ) {
    // Reset IOPS on all storage elements
    storageEntities.forEach(id => {
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
    storageEntities.forEach(id => {
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
    storageEntities.forEach(id => {
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
