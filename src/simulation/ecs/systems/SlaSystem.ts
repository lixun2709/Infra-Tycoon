import { System } from '../System'
import type { ApplicationComponent, ContractComponent, PowerComponent, TransformComponent, SecurityComponent } from '../types'
import { CONTRACT_CATALOG } from '../../../physics/contractLibrary'

export class SlaSystem extends System {
  // We only want SLA accounting to run every 60 ticks (1 simulation second) 
  // to perfectly match the billing and logging clock, and to minimize overhead.
  private executionTickCounter = 0

  public update(_dt: number): void {
    this.executionTickCounter++
    
    // SLA evaluations are heavy and tied to the 1-second simulation clock.
    if (this.executionTickCounter % 60 !== 0) return

    const apps = this.world.getComponentMap<ApplicationComponent>('application')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const contracts = this.world.getComponentMap<ContractComponent>('contract')

    if (contracts.size === 0) return

    // Precompute healthy running applications (O(N) operation instead of O(N^4))
    const healthyAppCounts = new Map<string, number>()

    apps.forEach((app) => {
      if (app.status === 'running') {
        const power = powerMap.get(app.nodeId)
        const transform = transformMap.get(app.nodeId)
        const security = this.world.getComponentMap<SecurityComponent>('security').get(app.nodeId)
        
        // Operational Realism: App is only "running" if the physical hardware has power
        // and is not currently administratively taken down for maintenance, isolated, or locked by ransomware.
        const isPowered = power ? power.isPowered : false
        const isMaintenance = transform ? transform.maintenanceMode : false
        const isBlackholed = transform ? transform.isBlackholed : false
        const isIsolated = security ? security.isIsolated : false
        const isRansomwareLocked = security ? security.infectionState === 'locked' : false

        if (isPowered && !isMaintenance && !isBlackholed && !isIsolated && !isRansomwareLocked) {
          healthyAppCounts.set(app.appId, (healthyAppCounts.get(app.appId) || 0) + 1)
        }
      }
    })

    // Evaluate contracts deterministically
    contracts.forEach((contract) => {
      const blueprint = CONTRACT_CATALOG[contract.blueprintId]
      if (!blueprint) return

      let isHealthy = true

      for (const req of blueprint.requirements) {
        const activeCount = healthyAppCounts.get(req.appId) || 0
        if (activeCount < req.count) {
          isHealthy = false
          break // Fail fast
        }
      }

      contract.totalTicks += 1
      if (isHealthy) {
        contract.uptimeTicks += 1
        contract.currentStatus = 'healthy'
      } else {
        // Accumulate penalty based on `dt` per tick or total missing time?
        // Since this evaluates once every 60 ticks (1 second), dt here is usually 1.0 (or total elapsed time for 60 frames, which is ~1s).
        // For simplicity and exact determinism matching the old system, we add `blueprint.penaltyPerTick`
        // (Note: the old system ran this 60 times a second and scaled penalty by dt, so we scale by 60 * dt or just blueprint.penaltyPerTick since this simulates 1 second of failure).
        // Let's assume this is evaluated exactly once per second, so penalty is 1 penalty unit per second.
        contract.accumulatedPenalty += blueprint.penaltyPerTick
        contract.currentStatus = 'violating'

        if (contract.accumulatedPenalty > 1000000) {
           this.world.eventBus.publish('system:alert', {
             entityId: contract.entityId,
             message: `CRITICAL: SLA Bankruptcy! Contract ${blueprint.name} has exceeded $1,000,000 in penalties.`,
             severity: 'critical'
           })
        }
      }
    })
  }
}
