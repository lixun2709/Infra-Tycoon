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
    const healthyAppFaultDomains = new Map<string, Set<string>>()
    const failedAppReasons = new Map<string, { isolated: number, blackholed: number, power: number, ransomware: number, other: number }>()

    apps.forEach((app) => {
      if (!failedAppReasons.has(app.appId)) {
        failedAppReasons.set(app.appId, { isolated: 0, blackholed: 0, power: 0, ransomware: 0, other: 0 })
      }

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
          
          let domainSet = healthyAppFaultDomains.get(app.appId)
          if (!domainSet) {
             domainSet = new Set<string>()
             healthyAppFaultDomains.set(app.appId, domainSet)
          }
          // Fault domain is rack if known, otherwise the node itself
          domainSet.add(transform?.parentRackId || app.nodeId)
        } else {
          const reasons = failedAppReasons.get(app.appId)!
          if (isRansomwareLocked) reasons.ransomware++
          else if (isIsolated) reasons.isolated++
          else if (isBlackholed) reasons.blackholed++
          else if (!isPowered) reasons.power++
          else reasons.other++
        }
      } else {
        const reasons = failedAppReasons.get(app.appId)!
        reasons.other++
      }
    })

    // Evaluate contracts deterministically
    contracts.forEach((contract) => {
      const blueprint = CONTRACT_CATALOG[contract.blueprintId]
      if (!blueprint) return

      let isHealthy = true

      for (const req of blueprint.requirements) {
        let activeCount = healthyAppCounts.get(req.appId) || 0
        
        // SLA Redundancy Enforcement:
        // True High-Availability requires fault-domain diversity.
        if (req.redundant) {
           const domains = healthyAppFaultDomains.get(req.appId)?.size || 0
           activeCount = Math.min(activeCount, domains)
        }
        
        if (activeCount < req.count) {
          isHealthy = false
          
          const deficit = req.count - activeCount
          const reasons = failedAppReasons.get(req.appId) || { isolated: 0, blackholed: 0, power: 0, ransomware: 0, other: deficit }
          
          let penaltyForThisTick = 0
          const totalFailing = reasons.ransomware + reasons.isolated + reasons.blackholed + reasons.power + reasons.other
          const ratio = totalFailing > 0 ? (deficit / totalFailing) : 1
          
          penaltyForThisTick += (reasons.ransomware * ratio) * 500
          penaltyForThisTick += ((reasons.isolated + reasons.blackholed) * ratio) * 300
          penaltyForThisTick += (reasons.power * ratio) * 150
          penaltyForThisTick += (reasons.other * ratio) * 50
          
          // Use maximum of blueprint base penalty or the dynamic penalty
          contract.accumulatedPenalty += Math.max(blueprint.penaltyPerTick, penaltyForThisTick)
          contract.currentStatus = 'violating'
          
          break // Found first failing requirement, we only apply one penalty per contract per tick
        }
      }

      contract.totalTicks += 1
      if (isHealthy) {
        contract.uptimeTicks += 1
        contract.currentStatus = 'healthy'
      } else {
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
