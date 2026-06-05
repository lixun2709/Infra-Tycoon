import { System } from '../System'
import { World } from '../World'
import type { AutomationPolicy } from '../../../store/infraTypes'
import type { ThermalComponent, TransformComponent, PowerComponent } from '../types'

export class AutomationSystem extends System {
  private policies: AutomationPolicy[] = []
  private firedPolicies: { id: string, firedAt: number }[] = []

  constructor(world: World) {
    super(world)
  }

  public setPolicies(policies: AutomationPolicy[]) {
    this.policies = policies || []
  }

  public flushFiredPolicies() {
    const fired = [...this.firedPolicies]
    this.firedPolicies = []
    return fired
  }

  public update(_dt: number): void {
    const now = Date.now()
    const activePolicies = this.policies.filter(p => p.enabled && (now - p.lastFiredAt) >= p.cooldownMs)
    if (activePolicies.length === 0) return

    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')

    transformMap.forEach((transform, nodeId) => {
      // Evaluate node-level policies
      for (const policy of activePolicies) {
        if (policy.targetLevel === 'node' && policy.targetId && policy.targetId !== nodeId) continue
        if (policy.targetLevel === 'site' && policy.targetId && policy.targetId !== transform.siteId) continue
        if (policy.targetLevel === 'rack' && policy.targetId && policy.targetId !== transform.parentRackId) continue
        
        let conditionMet = false

        if (policy.conditionType === 'temp_above') {
          const thermal = thermalMap.get(nodeId)
          if (thermal && thermal.temperature >= Number(policy.conditionValue)) {
            conditionMet = true
          }
        } else if (policy.conditionType === 'health_degraded') {
          if (transform.healthStatus === 'degraded' || transform.healthStatus === 'failed') {
            conditionMet = true
          }
        } else if (policy.conditionType === 'power_loss') {
          const power = powerMap.get(nodeId)
          if (power && !power.isPowered && !power.breakerTripped) {
            // Could be offline due to feed loss
            conditionMet = true
          }
        }

        if (conditionMet) {
          this.executeAction(policy, nodeId, transform.name || nodeId.slice(0, 8), now)
        }
      }
    })
  }

  private executeAction(policy: AutomationPolicy, nodeId: string, nodeName: string, now: number) {
    // Only fire if not already fired in this tick loop to prevent spam
    if (this.firedPolicies.some(f => f.id === policy.id)) return

    const power = this.world.getComponent<PowerComponent>('power', nodeId)
    let actionTaken = false

    if (policy.actionType === 'reboot_node') {
      if (power && power.systemState !== 'off') {
        power.systemState = 'booting'
        const prov = this.world.getComponent<import('../types').ProvisioningComponent>('provisioning', nodeId)
        if (prov) prov.bootProgress = 0
        actionTaken = true
        this.world.eventBus.publish('system:alert', {
          severity: 'warning',
          message: `[AUTOMATION] Policy '${policy.name}' triggered. Rebooting ${nodeName}.`,
          nodeId
        })
      }
    } else if (policy.actionType === 'shutdown_node') {
      if (power && power.systemState !== 'off') {
        power.systemState = 'off'
        actionTaken = true
        this.world.eventBus.publish('system:alert', {
          severity: 'warning',
          message: `[AUTOMATION] Policy '${policy.name}' triggered. Shutting down ${nodeName}.`,
          nodeId
        })
      }
    } else if (policy.actionType === 'notify_only') {
      actionTaken = true
      this.world.eventBus.publish('system:alert', {
        severity: 'info',
        message: `[AUTOMATION] Policy '${policy.name}' threshold reached on ${nodeName}.`,
        nodeId
      })
    }

    if (actionTaken) {
      this.firedPolicies.push({ id: policy.id, firedAt: now })
      policy.lastFiredAt = now // Update local reference immediately to prevent multiple triggers in same tick
    }
  }
}
