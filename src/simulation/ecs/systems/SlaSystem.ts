import { System } from '../System'
import type { ApplicationComponent, ContractComponent, PowerComponent, TransformComponent, SecurityComponent } from '../types'
import { CONTRACT_CATALOG } from '../../../physics/contractLibrary'

export class SlaSystem extends System {
  // We only want SLA accounting to run every 60 ticks (1 simulation second) 
  // to perfectly match the billing and logging clock, and to minimize overhead.
  private executionTickCounter = 0
  private healthyAppCounts = new Map<string, number>()
  private healthyAppFaultDomains = new Map<string, Set<string>>()
  private healthyAppRegions = new Map<string, Set<string>>()
  private failedAppReasons = new Map<string, { isolated: number, blackholed: number, power: number, ransomware: number, plannedMaintenance: number, other: number }>()

  public update(_dt: number): void {
    this.executionTickCounter++
    
    // SLA evaluations are heavy and tied to the 1-second simulation clock.
    if (this.executionTickCounter % 60 !== 0) return

    const apps = this.world.getComponentMap<ApplicationComponent>('application')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const contracts = this.world.getComponentMap<ContractComponent>('contract')

    if (contracts.size === 0) return

    // Zero-allocation Map reset
    this.healthyAppCounts.clear()
    
    this.healthyAppFaultDomains.forEach((set) => set.clear()) // Reset sets instead of discarding
    this.healthyAppRegions.forEach((set) => set.clear())
    // Do not clear the map itself for fault domains, just the sets within

    this.failedAppReasons.forEach((reasons) => {
      reasons.isolated = 0
      reasons.blackholed = 0
      reasons.power = 0
      reasons.ransomware = 0
      reasons.other = 0
    })

    apps.forEach((app) => {
      if (!this.failedAppReasons.has(app.appId)) {
        this.failedAppReasons.set(app.appId, { isolated: 0, blackholed: 0, power: 0, ransomware: 0, plannedMaintenance: 0, other: 0 })
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
          this.healthyAppCounts.set(app.appId, (this.healthyAppCounts.get(app.appId) || 0) + 1)
          
          let domainSet = this.healthyAppFaultDomains.get(app.appId)
          if (!domainSet) {
             domainSet = new Set<string>()
             this.healthyAppFaultDomains.set(app.appId, domainSet)
          }
          // Fault domain is rack if known, otherwise the node itself
          domainSet.add(transform?.parentRackId || app.nodeId)

          let regionSet = this.healthyAppRegions.get(app.appId)
          if (!regionSet) {
             regionSet = new Set<string>()
             this.healthyAppRegions.set(app.appId, regionSet)
          }
          regionSet.add(transform?.siteId || 'unknown')
        } else {
          const reasons = this.failedAppReasons.get(app.appId)!
          if (isMaintenance) reasons.plannedMaintenance++
          else if (isRansomwareLocked) reasons.ransomware++
          else if (isIsolated) reasons.isolated++
          else if (isBlackholed) reasons.blackholed++
          else if (!isPowered) reasons.power++
          else reasons.other++
        }
      } else {
        const reasons = this.failedAppReasons.get(app.appId)!
        reasons.other++
      }
    })

    // Evaluate contracts deterministically
    contracts.forEach((contract) => {
      const blueprint = CONTRACT_CATALOG[contract.blueprintId]
      if (!blueprint) return

      let isHealthy = true

      for (const req of blueprint.requirements) {
        let activeCount = this.healthyAppCounts.get(req.appId) || 0
        
        // SLA Redundancy Enforcement:
        // True High-Availability requires fault-domain diversity.
        let domains = 0
        if (req.redundant) {
           domains = this.healthyAppFaultDomains.get(req.appId)?.size || 0
           activeCount = Math.min(activeCount, domains)
        }

        let regions = 0
        if (req.multiRegion) {
           regions = this.healthyAppRegions.get(req.appId)?.size || 0
           if (regions < 2) {
             activeCount = 0 // Forced failure if multi-region is violated
           }
        }
        
        if (activeCount < req.count) {
          isHealthy = false
          
          const deficit = req.count - activeCount
          const reasons = this.failedAppReasons.get(req.appId) || { isolated: 0, blackholed: 0, power: 0, ransomware: 0, plannedMaintenance: 0, other: 0 }
          
          let penaltyForThisTick = 0
          
          // Total failing EXCLUDING planned maintenance
          let totalFailingUnplanned = reasons.ransomware + reasons.isolated + reasons.blackholed + reasons.power + reasons.other
          
          // If the deficit is larger than tracked failing reasons, it's a structural/redundancy violation.
          // Add the missing deficit to 'other'.
          if (totalFailingUnplanned + reasons.plannedMaintenance < deficit) {
            const structuralDeficit = deficit - (totalFailingUnplanned + reasons.plannedMaintenance)
            reasons.other += structuralDeficit
            totalFailingUnplanned += structuralDeficit
          }
          
          if (totalFailingUnplanned > 0) {
            // Deficit caused by unplanned outages
            const ratio = (deficit / totalFailingUnplanned)
            
            penaltyForThisTick += (reasons.ransomware * ratio) * 500
            penaltyForThisTick += ((reasons.isolated + reasons.blackholed) * ratio) * 300
            penaltyForThisTick += (reasons.power * ratio) * 150
            penaltyForThisTick += (reasons.other * ratio) * 50
            
            // Use maximum of blueprint base penalty or the dynamic penalty
            contract.accumulatedPenalty += Math.max(blueprint.penaltyPerTick, penaltyForThisTick)
            contract.currentStatus = 'violating'
            
            break // Found first failing requirement, we only apply one penalty per contract per tick
          } else {
             // If the only reason it's offline is planned maintenance, we do not penalize.
             contract.currentStatus = 'healthy' // Override to healthy during maintenance windows
          }
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
