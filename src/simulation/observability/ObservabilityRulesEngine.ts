import type { AlertRule } from './types'
import type { FiredAlert } from '../ecs/systems/ObservabilitySystem'

export class ObservabilityRulesEngine {
  // Nested maps to avoid string concatenation allocations (${rule.id}:${entityId})
  // Outer map: ruleId -> Inner map: entityId -> tick count
  private static ruleTriggerCounts = new Map<string, Map<string, number>>()
  private static activeAlertsMap = new Map<string, Set<string>>()

  /**
   * Clears the alerting engine states.
   */
  public static clear(): void {
    this.ruleTriggerCounts.clear()
    this.activeAlertsMap.clear()
  }

  public static initializeRule(ruleId: string): void {
    if (!this.ruleTriggerCounts.has(ruleId)) {
      this.ruleTriggerCounts.set(ruleId, new Map<string, number>())
      this.activeAlertsMap.set(ruleId, new Set<string>())
    }
  }

  public static clearRule(ruleId: string): void {
    this.ruleTriggerCounts.delete(ruleId)
    this.activeAlertsMap.delete(ruleId)
  }

  /**
   * Helper to perform rule threshold checks, count consecutive ticks, and fire alerts.
   * Completely zero-allocation by using nested maps keyed by existing string references.
   */
  public static checkThreshold(
    rule: AlertRule, 
    entityId: string, 
    value: number, 
    firedAlertsQueue: FiredAlert[],
    entityLabel?: string
  ): void {
    let countsMap = this.ruleTriggerCounts.get(rule.id)
    let alertsSet = this.activeAlertsMap.get(rule.id)

    if (!countsMap) {
      countsMap = new Map<string, number>()
      this.ruleTriggerCounts.set(rule.id, countsMap)
    }
    if (!alertsSet) {
      alertsSet = new Set<string>()
      this.activeAlertsMap.set(rule.id, alertsSet)
    }

    let isTriggered = false

    if (rule.operator === 'gt' && value > rule.threshold) {
      isTriggered = true
    } else if (rule.operator === 'lt' && value < rule.threshold) {
      isTriggered = true
    } else if (rule.operator === 'eq' && value === rule.threshold) {
      isTriggered = true
    }

    if (isTriggered) {
      const currentTicks = (countsMap.get(entityId) || 0) + 1
      countsMap.set(entityId, currentTicks)

      if (currentTicks >= rule.ticksNeeded && !alertsSet.has(entityId)) {
        // Threshold met! Fire alert
        const label = entityLabel ? ` [${entityLabel}]` : ''
        let message = `[OBSERVABILITY] ${rule.name}${label}: threshold violated (${value.toFixed(1)} / ${rule.threshold.toFixed(1)})`
        if (rule.metricType === 'storage') {
          message = `[OBSERVABILITY] ${rule.name}${label}: volume is ${(value * 100).toFixed(1)}% full`
        }

        firedAlertsQueue.push({
          severity: rule.severity,
          message,
          nodeId: entityId === 'global' ? undefined : entityId
        })
        alertsSet.add(entityId)
      }
    } else {
      // Threshold is happy, clear states so rules can fire again
      if (countsMap.has(entityId)) {
        countsMap.set(entityId, 0)
      }
      alertsSet.delete(entityId)
    }
  }
}
