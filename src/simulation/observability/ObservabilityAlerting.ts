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

  /**
   * Helper to fetch active rules.
   */
  public static getRules(): AlertRule[] {
    return this.rules
  }

  /**
   * Registers a new custom alert rule dynamically at runtime.
   */
  public static registerRule(rule: AlertRule): void {
    const existingIndex = this.rules.findIndex(r => r.id === rule.id)
    if (existingIndex !== -1) {
      this.rules[existingIndex] = rule
    } else {
      this.rules.push(rule)
    }
  }

  /**
   * Dynamically enables or disables a registered rule at runtime.
   */
  public static enableRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId)
    if (rule) {
      rule.isActive = enabled
    }
  }

  /**
   * Clears dynamically added rules and resets to default.
   */
  public static clear(): void {
    this.rules = [
      { id: 'rule-thermal', name: 'Critical Node Overheat Warning', metricType: 'temperature', threshold: 70, operator: 'gt', ticksNeeded: 3, severity: 'critical', isActive: true },
      { id: 'rule-power', name: 'High Power Grid Demand', metricType: 'power', threshold: 80, operator: 'gt', ticksNeeded: 2, severity: 'warning', isActive: true },
      { id: 'rule-storage', name: 'Storage Volume Exhaustion', metricType: 'storage', threshold: 0.90, operator: 'gt', ticksNeeded: 4, severity: 'warning', isActive: true },
      { id: 'rule-network', name: 'Interface Link Congestion Warning', metricType: 'network', threshold: 0, operator: 'gt', ticksNeeded: 2, severity: 'warning', isActive: true }
    ]
  }
}
