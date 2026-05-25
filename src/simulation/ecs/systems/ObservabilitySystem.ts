import { System } from '../System'
import { World } from '../World'
import type { 
  ThermalComponent, 
  TransformComponent
} from '../types'
import type { AlertRule, AlertSeverity } from '../../observability/types'
import { TelemetrySystem } from './TelemetrySystem'

export interface FiredAlert {
  severity: AlertSeverity
  message: string
  nodeId?: string
}

export class ObservabilitySystem extends System {
  private rules: AlertRule[] = [
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
  private ruleTriggerCounts = new Map<string, number>()

  // Track active fired alerts to prevent spam: key is "ruleId:entityId"
  private activeAlertsFired = new Set<string>()

  // Queue of alerts fired during this simulation tick
  private firedAlerts: FiredAlert[] = []

  constructor(world: World) {
    super(world)

    // Listen to local system:alert broadcasts on the ECS Event Bus
    this.world.eventBus.subscribe('system:alert', (evt) => {
      const payload = evt as { severity?: AlertSeverity; message?: string; entityId?: string; nodeId?: string }
      if (payload && payload.message) {
        this.pushFiredAlert({
          severity: payload.severity || 'info',
          message: payload.message,
          nodeId: payload.nodeId || payload.entityId
        })
      }
    })
  }

  /**
   * Destroys the system and removes it from active tracking.
   */
  public destroy(): void {
    this.clear()
  }

  /**
   * Registers a new custom alert rule dynamically at runtime.
   */
  public registerRule(rule: AlertRule): void {
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
  public enableRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId)
    if (rule) {
      rule.isActive = enabled
      if (!enabled) {
        // Clear counts and active alert tracking for this rule
        const keysToClear: string[] = []
        this.ruleTriggerCounts.forEach((_, key) => {
          if (key.startsWith(`${ruleId}:`)) {
            keysToClear.push(key)
          }
        })
        keysToClear.forEach(key => {
          this.ruleTriggerCounts.delete(key)
          this.activeAlertsFired.delete(key)
        })
      }
    }
  }

  /**
   * Retrieves all rules currently registered in the system.
   */
  public getRules(): AlertRule[] {
    return [...this.rules]
  }

  /**
   * Evaluates all observability rules against active simulation components in the ECS world.
   */
  public update(_dt: number): void {
    const startTime = performance.now()

    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    for (const rule of this.rules) {
      if (!rule.isActive) continue

      if (rule.metricType === 'power') {
        // O(1) Fetch from TelemetrySystem
        this.checkThreshold(rule, 'global', TelemetrySystem.simStats.totalPowerDrawKW)
      } 
      else if (rule.metricType === 'network') {
        // O(1) Fetch from TelemetrySystem
        this.checkThreshold(rule, 'global', TelemetrySystem.simStats.congestedLinkCount)
      } 
      else if (rule.metricType === 'storage') {
        // O(1) Fetch from TelemetrySystem
        const totalStorageCapacity = TelemetrySystem.simStats.totalStorageCapacityTB
        const totalStorageUsed = TelemetrySystem.simStats.totalStorageUsedTB
        const ratio = totalStorageCapacity > 0 ? totalStorageUsed / totalStorageCapacity : 0
        this.checkThreshold(rule, 'global', ratio)
      } 
      else if (rule.metricType === 'temperature') {
        // Temperature check runs per individual chassis node
        thermalMap.forEach((thermal, nodeId) => {
          const trans = transformMap.get(nodeId)
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

    const tEnd = performance.now()
    if (Math.random() < 0.1) {
      this.world.eventBus.publish('telemetry:system', {
        subsystem: 'observability',
        executionTimeMs: Number((tEnd - startTime).toFixed(2))
      })
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
      const currentTicks = (this.ruleTriggerCounts.get(key) || 0) + 1
      this.ruleTriggerCounts.set(key, currentTicks)

      if (currentTicks >= rule.ticksNeeded && !this.activeAlertsFired.has(key)) {
        // Threshold met! Fire alert to the worker tick's queue
        const label = entityLabel ? ` [${entityLabel}]` : ''
        let message = `[OBSERVABILITY] ${rule.name}${label}: threshold violated (${value.toFixed(1)} / ${rule.threshold.toFixed(1)})`
        if (rule.metricType === 'storage') {
          message = `[OBSERVABILITY] ${rule.name}${label}: volume is ${(value * 100).toFixed(1)}% full`
        }

        this.firedAlerts.push({
          severity: rule.severity,
          message,
          nodeId: entityId === 'global' ? undefined : entityId
        })
        this.activeAlertsFired.add(key)
      }
    } else {
      // Threshold is happy, clear states so rules can fire again
      this.ruleTriggerCounts.set(key, 0)
      this.activeAlertsFired.delete(key)
    }
  }

  /**
   * Pushes a new alert directly into the fired alerts queue.
   */
  public pushFiredAlert(alert: FiredAlert): void {
    this.firedAlerts.push(alert)
  }

  /**
   * Retrieves and clears the accumulated fired alerts from the static queue.
   */
  public flushAlerts(): FiredAlert[] {
    const alerts = [...this.firedAlerts]
    this.firedAlerts = []
    return alerts
  }

  /**
   * Clears the alerting engine states.
   */
  public clear(): void {
    this.ruleTriggerCounts.clear()
    this.activeAlertsFired.clear()
    this.firedAlerts = []
  }
}
