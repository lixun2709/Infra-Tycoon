import { System } from '../System'
import type { 
  ThermalComponent, 
  PowerComponent, 
  StorageComponent,
  ConnectionComponent,
  TransformComponent
} from '../types'
import type { AlertRule, AlertSeverity } from '../../observability/types'

export interface FiredAlert {
  severity: AlertSeverity
  message: string
  nodeId?: string
}

export class ObservabilitySystem extends System {
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

  // Queue of alerts fired during this simulation tick
  private static firedAlerts: FiredAlert[] = []

  /**
   * Evaluates all observability rules against active simulation components in the ECS world.
   */
  public update(_dt: number): void {
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const storageMap = this.world.getComponentMap<StorageComponent>('storage')
    const connectionMap = this.world.getComponentMap<ConnectionComponent>('connection')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    for (const rule of ObservabilitySystem.rules) {
      if (!rule.isActive) continue

      if (rule.metricType === 'power') {
        let totalPower = 0
        powerMap.forEach(p => {
          if (p.isPowered) {
            totalPower += p.load || 0.0
          }
        })
        this.checkThreshold(rule, 'global', totalPower)
      } 
      else if (rule.metricType === 'network') {
        let congestedLinks = 0
        connectionMap.forEach(conn => {
          if (conn.status === 'degraded') {
            congestedLinks++
          }
        })
        this.checkThreshold(rule, 'global', congestedLinks)
      } 
      else if (rule.metricType === 'storage') {
        let totalStorageUsed = 0.0
        let totalStorageCapacity = 0.0
        storageMap.forEach(s => {
          totalStorageUsed += s.usedStorageTB || 0.0
          totalStorageCapacity += s.totalStorageTB || 0.0
        })
        const ratio = totalStorageCapacity > 0 ? totalStorageUsed / totalStorageCapacity : 0
        this.checkThreshold(rule, 'global', ratio)
      } 
      else if (rule.metricType === 'temperature') {
        // Temperature check runs per individual chassis node!
        thermalMap.forEach((thermal, nodeId) => {
          const trans = transformMap.get(nodeId)
          // Filter out rack and cooling entities (only check chassis nodes)
          if (trans && trans.type !== 'rack' && trans.type !== 'cooling') {
            const temp = thermal.temperature ?? 0
            this.checkThreshold(
              rule, 
              nodeId, 
              temp, 
              trans.name || nodeId.slice(0, 8)
            )
          }
        })
      }
    }
  }

  /**
   * Helper to perform rule threshold checks, count consecutive ticks, and fire alerts.
   */
  private checkThreshold(rule: AlertRule, entityId: string, value: number, entityLabel?: string): void {
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
      const currentTicks = (ObservabilitySystem.ruleTriggerCounts.get(key) || 0) + 1
      ObservabilitySystem.ruleTriggerCounts.set(key, currentTicks)

      if (currentTicks >= rule.ticksNeeded && !ObservabilitySystem.activeAlertsFired.has(key)) {
        // Threshold met! Fire alert to the worker tick's queue
        const label = entityLabel ? ` [${entityLabel}]` : ''
        let message = `[OBSERVABILITY] ${rule.name}${label}: threshold violated (${value.toFixed(1)} / ${rule.threshold.toFixed(1)})`
        if (rule.metricType === 'storage') {
          message = `[OBSERVABILITY] ${rule.name}${label}: volume is ${(value * 100).toFixed(1)}% full`
        }

        ObservabilitySystem.firedAlerts.push({
          severity: rule.severity,
          message,
          nodeId: entityId === 'global' ? undefined : entityId
        })
        ObservabilitySystem.activeAlertsFired.add(key)
      }
    } else {
      // Threshold is happy, clear states so rules can fire again
      ObservabilitySystem.ruleTriggerCounts.set(key, 0)
      ObservabilitySystem.activeAlertsFired.delete(key)
    }
  }

  /**
   * Retrieves and clears the accumulated fired alerts from the static queue.
   */
  public static flushAlerts(): FiredAlert[] {
    const alerts = [...this.firedAlerts]
    this.firedAlerts = []
    return alerts
  }

  /**
   * Clears the alerting engine states.
   */
  public static clear(): void {
    this.ruleTriggerCounts.clear()
    this.activeAlertsFired.clear()
    this.firedAlerts = []
  }
}
