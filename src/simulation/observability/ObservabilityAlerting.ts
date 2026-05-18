import { useInfraStore } from '../../store/useInfraStore'
import { performanceMonitor } from '../PerformanceMonitor'
import type { AlertRule } from './types'

export class ObservabilityAlerting {
  private static rules: AlertRule[] = [
    {
      id: 'rule-thermal',
      name: 'Critical Node Overheat Warning',
      metricType: 'temperature',
      threshold: 70, // >= 70 degrees C
      operator: 'gt',
      ticksNeeded: 3,
      severity: 'critical',
      isActive: true
    },
    {
      id: 'rule-power',
      name: 'High Power Grid Demand',
      metricType: 'power',
      threshold: 80, // >= 80 kW load
      operator: 'gt',
      ticksNeeded: 2,
      severity: 'warning',
      isActive: true
    },
    {
      id: 'rule-storage',
      name: 'Storage Volume Exhaustion',
      metricType: 'storage',
      threshold: 0.90, // >= 90% full
      operator: 'gt',
      ticksNeeded: 4,
      severity: 'warning',
      isActive: true
    },
    {
      id: 'rule-network',
      name: 'Interface Link Congestion Warning',
      metricType: 'network',
      threshold: 0, // > 0 degraded connection
      operator: 'gt',
      ticksNeeded: 2,
      severity: 'warning',
      isActive: true
    }
  ]

  // Track consecutive ticks triggered: key is "ruleId:entityId"
  private static ruleTriggerCounts = new Map<string, number>()

  // Track active fired alerts to prevent spam: key is "ruleId:entityId"
  private static activeAlertsFired = new Set<string>()

  /**
   * Evaluates all observability rules against active simulation components and states.
   */
  public static evaluateRules(): void {
    const store = useInfraStore.getState()
    if (!store || !store.nodes || typeof store.pushAlert !== 'function') return
    const metrics = performanceMonitor.getMetrics()
    if (!metrics) return

    for (const rule of this.rules) {
      if (!rule.isActive) continue

      if (rule.metricType === 'power') {
        const value = metrics.simStats?.totalPowerDrawKW ?? 0
        this.checkThreshold(rule, 'global', value)
      } 
      else if (rule.metricType === 'network') {
        const value = metrics.simStats?.congestedLinkCount ?? 0
        this.checkThreshold(rule, 'global', value)
      } 
      else if (rule.metricType === 'storage' && metrics.simStats) {
        const capacity = metrics.simStats.totalStorageCapacityTB
        const used = metrics.simStats.totalStorageUsedTB
        const ratio = capacity > 0 ? used / capacity : 0
        this.checkThreshold(rule, 'global', ratio)
      } 
      else if (rule.metricType === 'temperature') {
        // Temperature check runs per individual chassis node!
        const nodes = store.nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
        for (const node of nodes) {
          const temp = node.temperature ?? 0
          this.checkThreshold(rule, node.id, temp, node.name || node.hostname || node.id.slice(0, 8))
        }
      }
    }
  }

  /**
   * Helper to perform rule threshold checks, count consecutive ticks, and fire alerts.
   */
  private static checkThreshold(rule: AlertRule, entityId: string, value: number, entityLabel?: string): void {
    const key = `${rule.id}:${entityId}`
    let isTriggered = false

    if (rule.operator === 'gt' && value > rule.threshold) {
      isTriggered = true
    } else if (rule.operator === 'lt' && value < rule.threshold) {
      isTriggered = true
    } else if (rule.operator === 'eq' && value === rule.threshold) {
      isTriggered = true
    }

    if (isTriggered) {
      const currentTicks = (this.ruleTriggerCounts.get(key) || 0) + 1
      this.ruleTriggerCounts.set(key, currentTicks)

      if (currentTicks >= rule.ticksNeeded && !this.activeAlertsFired.has(key)) {
        // Threshold met! Fire alert to Zustand store
        const store = useInfraStore.getState()
        const label = entityLabel ? ` [${entityLabel}]` : ''
        let message = `[OBSERVABILITY] ${rule.name}${label}: threshold violated (${value.toFixed(1)} / ${rule.threshold.toFixed(1)})`
        if (rule.metricType === 'storage') {
          message = `[OBSERVABILITY] ${rule.name}${label}: volume is ${(value * 100).toFixed(1)}% full`
        }

        store.pushAlert(rule.severity, message, entityId === 'global' ? undefined : entityId)
        this.activeAlertsFired.add(key)
      }
    } else {
      // Threshold is happy, clear states so rules can fire again
      this.ruleTriggerCounts.set(key, 0)
      this.activeAlertsFired.delete(key)
    }
  }

  /**
   * Helper to fetch active rules.
   */
  public static getRules(): AlertRule[] {
    return [...this.rules]
  }

  /**
   * Clears the alerting engine states.
   */
  public static clear(): void {
    this.ruleTriggerCounts.clear()
    this.activeAlertsFired.clear()
  }
}
