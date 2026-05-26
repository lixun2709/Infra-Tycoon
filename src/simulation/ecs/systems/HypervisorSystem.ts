import { System } from '../System'
import type { VmComponent, PowerComponent } from '../types'

/**
 * HypervisorSystem
 * ECS implementation of VMware ESXi simulation and vMotion logic.
 */
export class HypervisorSystem extends System {
  public update(dt: number) {
    const vmMap = this.world.getComponentMap<VmComponent>('vm')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')

    // Optional: we can compute shortest paths for vMotion if we need exact bandwidth,
    // but a simplified approach for now is to find direct bandwidth or assume a standard 10Gbps backbone if in the same site.

    const vmEntities = this.world.getEntitiesWith(['vm'])

    vmEntities.forEach(id => {
      const vm = vmMap.get(id)!
      const hostPower = powerMap.get(vm.nodeId)

      // High Availability (HA) / Power Loss detection
      if (!hostPower || !hostPower.isPowered) {
        if (vm.status === 'running' || vm.status === 'booting' || vm.status === 'migrating') {
          // Host failed, VM crashes
          vm.status = 'error'
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
        
        // If target loses power during migration, abort
        if (!targetPower || !targetPower.isPowered) {
          vm.status = 'running'
          vm.migratingToNodeId = undefined
          vm.migrationProgress = undefined
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
  }
}
