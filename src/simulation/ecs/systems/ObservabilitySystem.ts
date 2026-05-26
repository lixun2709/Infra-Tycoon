import { System } from '../System'
import { World } from '../World'
import type { 
  ThermalComponent, 
  TransformComponent
} from '../types'
import type { AlertRule, AlertSeverity } from '../../observability/types'
import { TelemetrySystem } from './TelemetrySystem'
import { ObservabilityAlerting } from '../../observability/ObservabilityAlerting'
import { ObservabilityRulesEngine } from '../../observability/ObservabilityRulesEngine'

export interface FiredAlert {
  severity: AlertSeverity
  message: string
  nodeId?: string
}

export class ObservabilitySystem extends System {
  // Queue of alerts fired during this simulation tick
  private firedAlerts: FiredAlert[] = []
  private telemetrySys?: TelemetrySystem

  constructor(
    world: World,
    telemetrySys?: TelemetrySystem
  ) {
    super(world)
    this.telemetrySys = telemetrySys

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
    ObservabilityAlerting.registerRule(rule)
  }

  /**
   * Dynamically enables or disables a registered rule at runtime.
   */
  public enableRule(ruleId: string, enabled: boolean): void {
    ObservabilityAlerting.enableRule(ruleId, enabled)
    if (!enabled) {
      ObservabilityRulesEngine.clearRule(ruleId)
    }
  }

  /**
   * Retrieves all rules currently registered in the system.
   */
  public getRules(): AlertRule[] {
    return ObservabilityAlerting.getRules()
  }

  /**
   * Evaluates all observability rules against active simulation components in the ECS world.
   */
  public update(_dt: number): void {
    const startTime = performance.now()

    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    const simStats = this.telemetrySys?.simStats

    for (const rule of ObservabilityAlerting.getRules()) {
      if (!rule.isActive) continue
      
      ObservabilityRulesEngine.initializeRule(rule.id)

      if (rule.metricType === 'power') {
        // O(1) Fetch from TelemetrySystem
        ObservabilityRulesEngine.checkThreshold(rule, 'global', simStats?.totalPowerDrawKW ?? 0, this.firedAlerts)
      } 
      else if (rule.metricType === 'network') {
        // O(1) Fetch from TelemetrySystem
        ObservabilityRulesEngine.checkThreshold(rule, 'global', simStats?.congestedLinkCount ?? 0, this.firedAlerts)
      } 
      else if (rule.metricType === 'storage') {
        // O(1) Fetch from TelemetrySystem
        const totalStorageCapacity = simStats?.totalStorageCapacityTB ?? 0
        const totalStorageUsed = simStats?.totalStorageUsedTB ?? 0
        const ratio = totalStorageCapacity > 0 ? totalStorageUsed / totalStorageCapacity : 0
        ObservabilityRulesEngine.checkThreshold(rule, 'global', ratio, this.firedAlerts)
      } 
      else if (rule.metricType === 'temperature') {
        // Temperature check runs per individual chassis node
        thermalMap.forEach((thermal, nodeId) => {
          const trans = transformMap.get(nodeId)
          if (trans && trans.type !== 'rack' && trans.type !== 'cooling') {
            const temp = thermal.temperature ?? 0
            ObservabilityRulesEngine.checkThreshold(
              rule, 
              nodeId, 
              temp, 
              this.firedAlerts,
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
    ObservabilityRulesEngine.clear()
    this.firedAlerts = []
  }
}
