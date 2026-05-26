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

    const vmEntities = this.world.getEntitiesWith(['vm'])

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
      this.processDRS(vmEntities, vmMap, powerMap, thermalMap)
    }
  }

  private processDRS(
    vmEntities: string[],
    vmMap: Map<string, VmComponent>,
    powerMap: Map<string, PowerComponent>,
    thermalMap: Map<string, import('../types').ThermalComponent>
  ) {
    // Check hosts for thermal stress
    const overloadedHosts = new Set<string>()
    thermalMap.forEach((thermal, hostId) => {
      if (thermal.isThrottled || thermal.temperature > 85) {
        overloadedHosts.add(hostId)
      }
    })

    if (overloadedHosts.size === 0) return

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
  }

  private findHealthyHost(
    powerMap: Map<string, PowerComponent>, 
    vmMap: Map<string, VmComponent>, 
    ignoreHostId: string,
    thermalMap?: Map<string, import('../types').ThermalComponent>
  ): string | null {
    // Basic HA host selection heuristic
    let bestHostId: string | null = null
    let minLoad = Infinity

    powerMap.forEach((power, hostId) => {
      if (hostId === ignoreHostId) return
      if (power.isPowered && power.systemState === 'running') {
         // If we are evaluating for DRS, skip hot hosts
         if (thermalMap) {
            const thermal = thermalMap.get(hostId)
            if (thermal && (thermal.isThrottled || thermal.temperature > 75)) return
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
