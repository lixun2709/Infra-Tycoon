 
import { System } from '../System'
import type { BackupComponent, StorageComponent, PowerComponent, SecurityComponent, TransformComponent } from '../types'

/**
 * BackupSystem
 * Handles deterministic data protection, periodic backup scheduling, 
 * data corruption spreading (e.g. ransomware), and node recovery states.
 * Runs autonomously in the ECS worker thread to prevent UI desync.
 */
export class BackupSystem extends System {
  // We run backup cycles less frequently than every 1s tick.
  // We'll accumulate dt and run evaluations every 10 seconds.
  private backupTimer = 0
  private backupInterval = 10.0

  public update(dt: number): void {
    this.backupTimer += dt

    const world = this.world
    const backupMap = this.world.getComponentMap<BackupComponent>('backup')
    const powerMap = world.getComponentMap<PowerComponent>('power')
    const storageMap = this.world.getComponentMap<StorageComponent>('storage')

    // Handle ongoing backup timers or ransomware corruption on every tick
    backupMap.forEach((backup, id) => {
      // If currently backing up, increment progress (simulate time-based completion)
      if (backup.backupStatus === 'backing_up') {
        let isFailing = false
        
        // Storage capacity check
        if (backup.backupTargetId) {
          const targetStorage = storageMap.get(backup.backupTargetId)
          if (targetStorage && targetStorage.usedStorageTB >= targetStorage.totalStorageTB) {
            isFailing = true
            backup.corruptionState = 'corrupted'
            this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `Backup Failed: Target storage full.`,
              severity: 'warning'
            })
          }
        }
        
        // Network blackhole check
        const transform = this.world.getComponentMap<TransformComponent>('transform').get(id)
        if (transform && transform.isBlackholed) {
           isFailing = true
           this.world.eventBus.publish('system:alert', {
              entityId: id,
              message: `Backup Failed: Network path blocked.`,
              severity: 'warning'
           })
        }

        if (isFailing) {
          backup.backupStatus = 'unprotected'
          
          const transform = this.world.getComponentMap<TransformComponent>('transform').get(id)
          if (transform) transform.isThrottled = false
        } else {
          const timeSince = Date.now() - backup.lastBackupTime
          
          // Strict Backup Window limit: 60 simulated seconds.
          // If a backup takes longer than 60s (e.g. due to bandwidth throttling), it times out and fails.
          if (timeSince > 60.0 && backup.backupStatus === 'backing_up') {
             backup.backupStatus = 'unprotected'
             const transform = this.world.getComponentMap<TransformComponent>('transform').get(id)
             if (transform) transform.isThrottled = false
             
             this.world.eventBus.publish('system:alert', {
                entityId: id,
                message: `Backup Failed: Backup Window (60s) exceeded due to network congestion/throttling.`,
                severity: 'error'
             })
             
             return // exit loop for this node
          }

          // Assume backups take 30 simulation seconds to complete
          if (timeSince > 30.0 && timeSince <= 60.0) {
            // Success! Deduct capacity from target
            if (backup.backupTargetId) {
              const targetStorage = storageMap.get(backup.backupTargetId)
              const sourceStorage = storageMap.get(id)
              
              if (targetStorage) {
                // Determine size to backup. Default to 1TB if no source storage info.
                let backupSizeTB = sourceStorage ? sourceStorage.usedStorageTB : 1.0
                
                // Deduplication logic
                if (targetStorage.deduplicationEnabled) {
                   const ratio = targetStorage.deduplicationRatio || 0.5
                   backupSizeTB = backupSizeTB * ratio
                }
                
                // Compression logic
                if (targetStorage.compressionEnabled) {
                   const cRatio = targetStorage.compressionRatio || 0.7
                   backupSizeTB = backupSizeTB * cRatio
                }

                targetStorage.usedStorageTB += backupSizeTB
              }
            }

            backup.backupStatus = 'protected'
            backup.corruptionState = 'clean'
            
            const transform = this.world.getComponentMap<TransformComponent>('transform').get(id)
            if (transform) transform.isThrottled = false
          }
        }
      }

      // Handle ransomware/corruption propagation
      const security = this.world.getComponentMap<SecurityComponent>('security').get(id)
      if (security && security.infectionState && security.infectionState !== 'clean') {
        if (!backup.isImmutable && backup.corruptionState !== 'ransomware') {
          backup.corruptionState = 'ransomware'
          // A ransomware infection immediately invalidates unprotected backups
          if (backup.backupStatus !== 'backing_up') {
            backup.backupStatus = 'unprotected'
          }
        }
      } else if (backup.corruptionState === 'ransomware') {
        // If the infection was cleared externally (e.g., node was formatted/restored)
        backup.corruptionState = 'clean'
      }
    })

    // Perform periodic large-scale evaluations
    if (this.backupTimer >= this.backupInterval) {
      this.backupTimer = 0
      this.processBackupJobs(backupMap, powerMap, storageMap)
    }
  }

  private processBackupJobs(
    backupMap: Map<string, BackupComponent>,
    powerMap: Map<string, PowerComponent>,
    storageMap: Map<string, StorageComponent>
  ) {
    const time = Date.now()

    // 1. Identify valid backup target nodes (servers that are powered on, have storage, and are designated 'backup' nodes)
    const backupTargets: string[] = []
    
    // We iterate over storage to find nodes with high capacity.
    // In a real scenario, we might explicitly check if node.type === 'backup' using an external index,
    // but we can infer capacity here. Let's assume nodes with > 0 totalStorageTB are candidates.
    storageMap.forEach((storage, id) => {
      const power = powerMap.get(id)
      if (power && power.isPowered && power.systemState === 'running') {
        // If they have space and are healthy
        if (storage.storageStatus === 'healthy' && storage.totalStorageTB > storage.usedStorageTB) {
          backupTargets.push(id)
        }
      }
    })

    if (backupTargets.length === 0) {
      // No active backup targets available! We can't process any new backups.
      return
    }

    // 2. Process unprotected nodes to schedule them
    backupMap.forEach((backup, id) => {
      if (backup.backupStatus === 'unprotected') {
        const power = powerMap.get(id)
        if (power && power.isPowered && power.systemState === 'running') {
          // Attempt to assign a backup target
          // In a scalable system, we might pick the target with the most free space.
          // For deterministic simplicity, just pick the first available.
          const targetId = backupTargets[0]
          
          if (targetId) {
            backup.backupStatus = 'backing_up'
            backup.lastBackupTime = time
            backup.backupTargetId = targetId
            
            // Backup Storm Network Congestion: Heavily throttle the node's network interfaces
            const transform = this.world.getComponentMap<TransformComponent>('transform').get(id)
            if (transform) transform.isThrottled = true
            // We could deduct some storage capacity from the target, but we'll leave that to StorageSystem
          }
        }
      } else if (backup.backupStatus === 'protected') {
        // Verify the backup is still valid (e.g. target is still alive)
        // Check if 24 hours (simulated) have passed to re-trigger a backup
        const age = time - backup.lastBackupTime
        // Assume 1 hour simulation time = 3600 seconds. Require backup every 1 hour.
        if (age > 3600.0) {
          backup.backupStatus = 'unprotected'
        }
      }
    })
  }
}

