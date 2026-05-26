export interface TraceSpan {
  traceId: number
  spanId: number
  parentSpanId?: number
  name: string
  timestamp: number
  durationMs?: number
  status: 'success' | 'failed' | 'running'
  metadata?: Record<string, unknown>
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertRule {
  id: string
  name: string
  metricType: 'power' | 'temperature' | 'storage' | 'network'
  threshold: number
  operator: 'gt' | 'lt' | 'eq'
  ticksNeeded: number
  severity: AlertSeverity
  isActive: boolean
}
