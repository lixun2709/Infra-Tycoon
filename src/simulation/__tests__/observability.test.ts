import { describe, it, expect, beforeEach } from 'vitest'
import { ObservabilityTracer } from '../observability/ObservabilityTracer'
import { PrometheusExporter } from '../observability/PrometheusExporter'
import { ObservabilityAlerting } from '../observability/ObservabilityAlerting'

describe('Enterprise Observability Subsystem Core Tests', () => {
  beforeEach(() => {
    ObservabilityTracer.clear()
    ObservabilityAlerting.clear()
  })

  describe('ObservabilityTracer Subsystem', () => {
    it('should successfully create, track and close transaction spans', () => {
      const spanId = ObservabilityTracer.startSpan('database_query', undefined, { query: 'SELECT *' })
      expect(spanId).toBeDefined()
      
      ObservabilityTracer.endSpan(spanId, 'success', { rows: 5 })
      
      const spans = ObservabilityTracer.getSpans()
      expect(spans.length).toBe(1)
      const firstSpan = spans[0]!
      expect(firstSpan.name).toBe('database_query')
      expect(firstSpan.status).toBe('success')
      expect(firstSpan.metadata?.query).toBe('SELECT *')
      expect(firstSpan.metadata?.rows).toBe(5)
      expect(firstSpan.durationMs).toBeDefined()
    })

    it('should respect max sliding ring-buffer capacity limits to prevent memory leaks', () => {
      // Push 110 spans to trigger shifting of sliding 100 limit
      for (let i = 0; i < 110; i++) {
        const id = ObservabilityTracer.startSpan(`span_${i}`)
        ObservabilityTracer.endSpan(id, 'success')
      }

      const spans = ObservabilityTracer.getSpans()
      expect(spans.length).toBe(100) // Capped at MAX_SPANS = 100
      expect(spans[0]!.name).toBe('span_10') // Shifting 0-9 off
      expect(spans[99]!.name).toBe('span_109')
    })
  })

  describe('PrometheusExporter Subsystem', () => {
    it('should generate standard openmetrics metrics payload correctly', () => {
      const exported = PrometheusExporter.exportMetrics()
      expect(exported).toContain('# HELP infra_tycoon_fps')
      expect(exported).toContain('# TYPE infra_tycoon_fps gauge')
      expect(exported).toContain('infra_tycoon_fps')
      
      expect(exported).toContain('infra_tycoon_ecs_entities_total')
      expect(exported).toContain('infra_tycoon_balance_dollars')
    })
  })

  describe('ObservabilityAlerting Subsystem', () => {
    it('should define robust, realistic default alert rules', () => {
      const rules = ObservabilityAlerting.getRules()
      expect(rules.length).toBe(4)
      expect(rules.map(r => r.metricType)).toContain('temperature')
      expect(rules.map(r => r.metricType)).toContain('power')
      expect(rules.map(r => r.metricType)).toContain('storage')
      expect(rules.map(r => r.metricType)).toContain('network')
    })
  })
})
