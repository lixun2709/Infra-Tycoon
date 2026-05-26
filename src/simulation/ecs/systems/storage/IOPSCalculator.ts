import type { StorageComponent, ApplicationComponent, ThermalComponent, ComponentMap } from '../../types'

export class IOPSCalculator {
  // Object pool for host-to-apps mapping to prevent GC spikes
  private static hostToApps = new Map<string, string[]>()

  /**
   * Assigns IOPS load from running apps to storage hosts, processes deduplication/compression overhead,
   * and handles cascading thermal thrashing.
   */
  public static processIOPSAndThrashing(
    storageEntities: readonly string[],
    appEntities: readonly string[],
    storageMap: ComponentMap<StorageComponent>,
    appMap: ComponentMap<ApplicationComponent>,
    thermalMap: ComponentMap<ThermalComponent>,
    dt: number
  ) {
    // 0. Reset static pools
    this.hostToApps.forEach(arr => { arr.length = 0 })

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
        let hostApps = this.hostToApps.get(hostId)
        if (!hostApps) {
          hostApps = []
          this.hostToApps.set(hostId, hostApps)
        }
        hostApps.push(appId)

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
        const appsOnHost = this.hostToApps.get(id)
        if (appsOnHost) {
          for (let i = 0; i < appsOnHost.length; i++) {
            const appId = appsOnHost[i]!
            const app = appMap.get(appId)
            if (app) app.status = 'error'
          }
        }
      }
    })
  }
}
