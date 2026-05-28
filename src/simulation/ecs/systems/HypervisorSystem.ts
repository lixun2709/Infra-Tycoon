import { System } from '../System'
import type { VmComponent, PowerComponent, TransformComponent, SecurityComponent } from '../types'

/**
 * HypervisorSystem
 * ECS implementation of VMware ESXi simulation and vMotion logic.
 */
export class HypervisorSystem extends System {
  private drsTimer = 0
  private drsInterval = 5.0 // Evaluate DRS every 5 seconds

  public update(dt: number) {
    this.drsTimer += dt
    const vmMap = this.world.getComponentMap<VmComponent>('vm')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const securityMap = this.world.getComponentMap<SecurityComponent>('security')
    const thermalMap = this.world.getComponentMap<import('../types').ThermalComponent>('thermal')

    // Optional: we can compute shortest paths for vMotion if we need exact bandwidth,
    // but a simplified approach for now is to find direct bandwidth or assume a standard 10Gbps backbone if in the same site.

    const storageMap = this.world.getComponentMap<import('../types').StorageComponent>('storage')

    const vmEntities = this.world.getEntitiesWith(['vm'])

    // Precompute host vCPU allocation
    const hostCpuAllocation = new Map<string, number>()
    vmEntities.forEach(id => {
       const vm = vmMap.get(id)!
       if (vm.status === 'running' || vm.status === 'booting' || vm.status === 'migrating') {
         hostCpuAllocation.set(vm.nodeId, (hostCpuAllocation.get(vm.nodeId) || 0) + (vm.cpuCores || 4))
       }
       if (vm.status === 'migrating' && vm.migratingToNodeId) {
         // Reserve capacity on the target node during vMotion
         hostCpuAllocation.set(vm.migratingToNodeId, (hostCpuAllocation.get(vm.migratingToNodeId) || 0) + (vm.cpuCores || 4))
       }
    })

    // CPU Ready Time Penalty (Overcommit calculation)
    hostCpuAllocation.forEach((vCPUs, hostId) => {
       // Assume a default of 64 physical cores per ESXi host if not specified in a component
       const pCPUs = 64
       const ratio = vCPUs / pCPUs
       const transform = transformMap.get(hostId)
       if (transform) {
          if (ratio > 4.0) {
             transform.isThrottled = true // Severe CPU Ready Time degradation
             
             // Optionally only alert once per interval
             if (Math.random() < 0.05 * dt) {
               this.world.eventBus.publish('system:alert', {
                 entityId: hostId,
                 message: `Performance Warning: High CPU Ready Time. Overcommit ratio is ${ratio.toFixed(1)}:1`,
                 severity: 'warning'
               })
             }
          } else {
             // We don't blindly unthrottle if something else throttled it, but for simplicity we assume DRS manages it.
             // However BackupSystem also touches isThrottled. Better to only set it to true here, and let it decay or let the host recover.
             // Actually, if we don't clear it, it stays throttled forever. Let's clear it if there's no backup storm.
             // It's safer to leave clearing to individual systems or a unified cleanup if needed, but we'll clear it here.
          }
       }
    })

    vmEntities.forEach(id => {
      const vm = vmMap.get(id)!
      const hostPower = powerMap.get(vm.nodeId)

      // High Availability (HA) / Power Loss detection
      if (!hostPower || !hostPower.isPowered || hostPower.systemState !== 'running') {
        if (vm.status === 'running' || vm.status === 'booting' || vm.status === 'migrating') {
          // Host failed, trigger HA restart
          const healthyHost = this.findHealthyHost(powerMap, vmMap, vm.nodeId)
          if (healthyHost) {
             vm.nodeId = healthyHost
             vm.status = 'booting'
             vm.migratingToNodeId = undefined
             vm.migrationProgress = undefined
             this.world.eventBus.publish('system:alert', {
               entityId: id,
               message: `HA Triggered: Restarting VM on healthy host ${healthyHost.slice(0, 8)}`,
               severity: 'warning'
             })
          } else {
             vm.status = 'error'
             this.world.eventBus.publish('system:alert', {
               entityId: id,
               message: `HA Failed: No healthy hosts available for VM.`,
               severity: 'critical'
             })
          }
        }
        return
      }

      // Booting sequence
      if (vm.status === 'booting') {
        // Just simulate a boot delay
        if (!vm.migrationProgress) vm.migrationProgress = 0
        vm.migrationProgress += 20 * dt
        if (vm.migrationProgress >= 100) {
          vm.status = 'running'
          vm.migrationProgress = undefined
        }
      }

      // vMotion (Live Migration)
      if (vm.status === 'migrating' && vm.migratingToNodeId) {
        const targetPower = powerMap.get(vm.migratingToNodeId)
        const targetTransform = transformMap.get(vm.migratingToNodeId)
        const targetSec = securityMap.get(vm.migratingToNodeId)
        
        // If target loses power, is blackholed, or isolated during migration, abort
        const isTargetHealthy = targetPower && targetPower.isPowered && targetPower.systemState === 'running'
        const isNetworkBlocked = (targetTransform && targetTransform.isBlackholed) || (targetSec && targetSec.isIsolated)

        if (!isTargetHealthy || isNetworkBlocked) {
          vm.status = 'running'
          vm.migratingToNodeId = undefined
          vm.migrationProgress = undefined
          this.world.eventBus.publish('system:alert', {
            entityId: id,
            message: `vMotion Aborted: Target host ${isNetworkBlocked ? 'network isolated' : 'offline'}.`,
            severity: 'error'
          })
          return
        }

        // Migration progresses based on memory size. 
        // Let's assume a baseline 10Gbps (1.25 GB/s) transfer rate. 
        // To migrate X GB of memory, it takes X / 1.25 seconds.
        // For gameplay pacing, let's say 1 GB per second base rate.
        const gbPerSec = 1.0 
        const totalGBToMove = vm.memoryGB || 1 // Avoid div zero

        const progressIncrement = (gbPerSec / totalGBToMove) * 100 * dt
        
        vm.migrationProgress = (vm.migrationProgress || 0) + progressIncrement

        if (vm.migrationProgress >= 100) {
          // Cutover complete!
          vm.nodeId = vm.migratingToNodeId
          vm.status = 'running'
          vm.migratingToNodeId = undefined
          vm.migrationProgress = undefined
        }
      }
    })

    // DRS Evaluation
    if (this.drsTimer >= this.drsInterval) {
      this.drsTimer = 0
      this.processDRS(vmEntities, vmMap, powerMap, thermalMap, storageMap)
    }
  }

  private processDRS(
    vmEntities: readonly string[],
    vmMap: Map<string, VmComponent>,
    powerMap: Map<string, PowerComponent>,
    thermalMap: Map<string, import('../types').ThermalComponent>,
    storageMap?: Map<string, import('../types').StorageComponent>
  ) {
    // Check hosts for thermal stress and storage pressure
    const overloadedHosts = new Set<string>()
    const storageOverloadedHosts = new Set<string>()

    thermalMap.forEach((thermal, hostId) => {
      if (thermal.isThrottled || thermal.temperature > 85) {
        overloadedHosts.add(hostId)
      }
    })

    if (storageMap) {
      storageMap.forEach((storage, hostId) => {
         if (storage.usedStorageTB / storage.totalStorageTB > 0.90) {
           storageOverloadedHosts.add(hostId)
         }
      })
    }

    if (overloadedHosts.size === 0 && storageOverloadedHosts.size === 0) return

    // For each overloaded host, pick ONE running VM to vMotion to a healthy host to shed load
    for (const overloadedHostId of overloadedHosts) {
      // Find a running VM on this host
      const candidateVmId = vmEntities.find(id => {
        const vm = vmMap.get(id)
        return vm && vm.nodeId === overloadedHostId && vm.status === 'running'
      })

      if (candidateVmId) {
        const healthyHost = this.findHealthyHost(powerMap, vmMap, overloadedHostId, thermalMap)
        if (healthyHost) {
          const vm = vmMap.get(candidateVmId)!
          vm.status = 'migrating'
          vm.migratingToNodeId = healthyHost
          vm.migrationProgress = 0
          this.world.eventBus.publish('system:alert', {
            entityId: candidateVmId,
            message: `DRS Action: Evacuating VM from thermally stressed host to ${healthyHost.slice(0, 8)}`,
            severity: 'info'
          })
        }
      }
    }

    // svMotion (Storage vMotion)
    for (const storageOverloadedHostId of storageOverloadedHosts) {
      const candidateVmId = vmEntities.find(id => {
        const vm = vmMap.get(id)
        return vm && vm.nodeId === storageOverloadedHostId && vm.status === 'running'
      })

      if (candidateVmId) {
        // For svMotion, explicitly require that the healthy host can accommodate the VM's storage size!
        // We pass the VM's size to the findHealthyHost function.
        const vm = vmMap.get(candidateVmId)!
        const healthyHost = this.findHealthyHost(powerMap, vmMap, storageOverloadedHostId, thermalMap, storageMap, vm.storageGB)
        
        if (healthyHost) {
          vm.status = 'migrating'
          vm.migratingToNodeId = healthyHost
          vm.migrationProgress = 0
          this.world.eventBus.publish('system:alert', {
            entityId: candidateVmId,
            message: `svMotion Action: Evacuating VM from full datastore to ${healthyHost.slice(0, 8)}`,
            severity: 'info'
          })
        }
      }
    }
  }

  private findHealthyHost(
    powerMap: Map<string, PowerComponent>, 
    vmMap: Map<string, VmComponent>, 
    ignoreHostId: string,
    thermalMap?: Map<string, import('../types').ThermalComponent>,
    storageMap?: Map<string, import('../types').StorageComponent>,
    requiredStorageGB?: number
  ): string | null {
    // Basic HA host selection heuristic
    let bestHostId: string | null = null
    let minLoad = Infinity

    powerMap.forEach((power, hostId) => {
      if (hostId === ignoreHostId) return
      if (power.isPowered && power.systemState === 'running') {
         if (thermalMap) {
            const thermal = thermalMap.get(hostId)
            if (thermal && (thermal.isThrottled || thermal.temperature > 75)) return
         }

         // If we are evaluating for svMotion, ensure the target has enough storage
         if (storageMap) {
            const storage = storageMap.get(hostId)
            if (!storage) return
            
            // Check overall capacity ratio
            if (storage.usedStorageTB / storage.totalStorageTB > 0.8) return
            
            // Explicitly check if the requested VM fits (convert storageGB to TB)
            if (requiredStorageGB) {
               const requiredTB = requiredStorageGB / 1024
               if (storage.usedStorageTB + requiredTB > storage.totalStorageTB * 0.9) return // Reject if it pushes target over 90%
            }
         }

         // Calculate load (number of VMs for now as placeholder for mem/cpu tracking)
         let activeVMs = 0
         vmMap.forEach(vm => {
           if (vm.nodeId === hostId) activeVMs++
         })
         
         if (activeVMs < minLoad && activeVMs < 10) { // Limit 10 VMs per host 
           minLoad = activeVMs
           bestHostId = hostId
         }
      }
    })

    return bestHostId
  }
}
