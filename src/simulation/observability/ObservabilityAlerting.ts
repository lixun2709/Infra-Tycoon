import { simEngine } from '../SimulationEngine'
import { ObservabilitySystem } from '../ecs/systems/ObservabilitySystem'
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
   * Helper to fetch active rules.
   */
  public static getRules(): AlertRule[] {
    const obs = simEngine.getSystemManager().getSystem(ObservabilitySystem)
    return obs ? obs.getRules() : [...this.rules]
  }

  /**
   * Clears the alerting engine states.
   */
  public static clear(): void {
    this.ruleTriggerCounts.clear()
    this.activeAlertsFired.clear()
  }
}
