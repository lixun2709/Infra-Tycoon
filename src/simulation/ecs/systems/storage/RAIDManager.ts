import type { StorageComponent, PowerComponent, TransformComponent } from '../types'
import { ComponentMap } from '../ComponentMap'
import { EventBus } from '../../../core/EventBus'

export class RAIDManager {
  /**
   * Processes drive wear degradation, Write Amplification Factor (WAF), RAID failure thresholds, and rebuilding.
   */
  public static processRAIDStatus(
    entities: string[],
    storageMap: ComponentMap<StorageComponent>,
    powerMap: ComponentMap<PowerComponent>,
    transformMap: ComponentMap<TransformComponent>,
    dt: number,
    eventBus: EventBus
  ) {
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
      storage.driveDegradation = Math.min(100, (storage.driveDegradation ?? 0) + wearIncrement)

      // Disk Failure triggers
      if (storage.driveDegradation >= 99.0 && storage.storageStatus !== 'failed') {
        storage.driveDegradation = 0.0 // Reset wear on failure

        if (raid === 'RAID0' || raid === 'JBOD') {
          storage.storageStatus = 'failed'
          storage.failedDrives = (storage.failedDrives ?? 0) + 1
          eventBus.publish('system:alert', {
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
            eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array degraded on ${id}. RAID level RAID6 operating with 1 failed drive.`,
              severity: 'warning'
            })
          } else if (storage.failedDrives === 2) {
            storage.storageStatus = 'highly_degraded'
            storage.ioPSLimit = Math.floor(base * 0.4)
            eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array highly degraded on ${id}. RAID level RAID6 operating with 2 failed drives.`,
              severity: 'warning'
            })
          } else {
            storage.storageStatus = 'failed'
            eventBus.publish('system:alert', {
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
            eventBus.publish('system:alert', {
              entityId: id,
              message: `WARNING: Storage Array degraded on ${id}. RAID level ${raid} operating in degraded state.`,
              severity: 'warning'
            })
          } else {
            storage.storageStatus = 'failed'
            eventBus.publish('system:alert', {
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
          eventBus.publish('system:alert', {
            entityId: id,
            message: `INFO: Storage Array rebuild complete on ${id}. Restored to healthy status.`,
            severity: 'info'
          })
        }
      }
    })
  }
}
