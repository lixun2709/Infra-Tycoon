import { useInfraStore } from '../../store/useInfraStore'
import { performanceMonitor } from '../PerformanceMonitor'

export class PrometheusExporter {
  private static HELP_CACHE = new Map<string, string>()

  /**
   * Helper to write standard Prometheus metric metadata.
   */
  private static metricHelp(name: string, type: 'gauge' | 'counter', help: string): string {
    if (!this.HELP_CACHE.has(name)) {
      this.HELP_CACHE.set(name, `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n`)
    }
    return this.HELP_CACHE.get(name)!
  }

  /**
   * Generates a fully formatted Prometheus exposition format string of the simulation state.
   */
  public static exportMetrics(): string {
    const store = useInfraStore.getState()
    const metrics = performanceMonitor.getMetrics()
    const out: string[] = []

    // 1. Host Performance Metrics
    out.push(this.metricHelp('infra_tycoon_fps', 'gauge', 'Main thread frames per second.'))
    out.push(`infra_tycoon_fps ${metrics.fps}\n\n`)

    out.push(this.metricHelp('infra_tycoon_frame_time_ms', 'gauge', 'Main thread frame update duration in milliseconds.'))
    out.push(`infra_tycoon_frame_time_ms ${metrics.frameTime.toFixed(3)}\n\n`)

    out.push(this.metricHelp('infra_tycoon_frame_jitter_ms', 'gauge', 'Frame update delay jitter variance in milliseconds.'))
    out.push(`infra_tycoon_frame_jitter_ms ${(metrics.frameJitter ?? 0.0).toFixed(3)}\n\n`)

    out.push(this.metricHelp('infra_tycoon_js_heap_bytes', 'gauge', 'JS engine memory allocation details.'))
    out.push(`infra_tycoon_js_heap_bytes{type="used"} ${metrics.usedJSHeapSize ?? 0}\n`)
    out.push(`infra_tycoon_js_heap_bytes{type="total"} ${metrics.totalJSHeapSize ?? 0}\n`)
    out.push(`infra_tycoon_js_heap_bytes{type="limit"} ${metrics.jsHeapSizeLimit ?? 0}\n\n`)

    // 2. Web Worker Simulation Thread Diagnostics
    out.push(this.metricHelp('infra_tycoon_worker_tick_duration_ms', 'gauge', 'Background simulation cycle calculation time in milliseconds.'))
    out.push(`infra_tycoon_worker_tick_duration_ms ${metrics.simTickTime.toFixed(4)}\n\n`)

    out.push(this.metricHelp('infra_tycoon_worker_latency_ms', 'gauge', 'Message roundtrip latency between main and worker threads.'))
    out.push(`infra_tycoon_worker_latency_ms ${metrics.workerLatency.toFixed(2)}\n\n`)

    out.push(this.metricHelp('infra_tycoon_worker_backpressure_ratio', 'gauge', 'Active worker queue backpressure load index.'))
    out.push(`infra_tycoon_worker_backpressure_ratio ${(metrics.backpressureRatio ?? 0.0).toFixed(4)}\n\n`)

    out.push(this.metricHelp('infra_tycoon_worker_dropped_ticks_total', 'counter', 'Total simulation ticks dropped due to queue congestion.'))
    out.push(`infra_tycoon_worker_dropped_ticks_total ${metrics.droppedTicks ?? 0}\n\n`)

    // 3. ECS Core Metrics
    out.push(this.metricHelp('infra_tycoon_ecs_entities_total', 'gauge', 'Total active registered entities inside ECS simulation world.'))
    out.push(`infra_tycoon_ecs_entities_total ${metrics.entityCount}\n\n`)

    out.push(this.metricHelp('infra_tycoon_ecs_cache_hit_ratio', 'gauge', 'Entity query cache hit ratio index.'))
    out.push(`infra_tycoon_ecs_cache_hit_ratio ${metrics.cacheHitRatio.toFixed(4)}\n\n`)

    // 4. WebGL Render pipeline
    out.push(this.metricHelp('infra_tycoon_webgl_draw_calls_total', 'gauge', 'Three.js pipeline draw calls per frame.'))
    out.push(`infra_tycoon_webgl_draw_calls_total ${metrics.drawCalls}\n\n`)

    out.push(this.metricHelp('infra_tycoon_webgl_triangles_total', 'gauge', 'WebGL pipeline triangles count per frame.'))
    out.push(`infra_tycoon_webgl_triangles_total ${metrics.triangles}\n\n`)

    // 5. Deterministic Operational Metrics (Day 35 Stats)
    if (metrics.simStats) {
      const stats = metrics.simStats
      out.push(this.metricHelp('infra_tycoon_sim_uptime_ratio', 'gauge', 'Average operational hardware uptime ratio.'))
      out.push(`infra_tycoon_sim_uptime_ratio ${stats.averageUptimeRatio.toFixed(4)}\n\n`)

      out.push(this.metricHelp('infra_tycoon_sim_power_draw_kw', 'gauge', 'Total power wattage loaded across server chassis.'))
      out.push(`infra_tycoon_sim_power_draw_kw ${stats.totalPowerDrawKW.toFixed(3)}\n\n`)

      out.push(this.metricHelp('infra_tycoon_sim_hotspots_total', 'gauge', 'Chassis nodes running above critical temperature thresholds.'))
      out.push(`infra_tycoon_sim_hotspots_total ${stats.overheatedNodeCount}\n\n`)

      out.push(this.metricHelp('infra_tycoon_sim_congested_links_total', 'gauge', 'Overburdened high-density network fiber lines.'))
      out.push(`infra_tycoon_sim_congested_links_total ${stats.congestedLinkCount}\n\n`)

      out.push(this.metricHelp('infra_tycoon_sim_storage_bytes', 'gauge', 'Summed storage utilization and limit specs.'))
      out.push(`infra_tycoon_sim_storage_bytes{type="used"} ${(stats.totalStorageUsedTB * 1e12).toFixed(0)}\n`)
      out.push(`infra_tycoon_sim_storage_bytes{type="capacity"} ${(stats.totalStorageCapacityTB * 1e12).toFixed(0)}\n\n`)
    }

    // 6. Global Tycoon State (Zustand Store)
    out.push(this.metricHelp('infra_tycoon_balance_dollars', 'gauge', 'Current capital balance of the operating corporation.'))
    out.push(`infra_tycoon_balance_dollars ${store.balance}\n\n`)

    out.push(this.metricHelp('infra_tycoon_reputation_percent', 'gauge', 'Contractual reliability index representing operational SLA trust.'))
    out.push(`infra_tycoon_reputation_percent ${store.reputation}\n\n`)

    out.push(this.metricHelp('infra_tycoon_alerts_total', 'gauge', 'Active unacknowledged operations incidents.'))
    out.push(`infra_tycoon_alerts_total ${store.alerts.filter((a: any) => !a.isAcknowledged).length}\n`)

    return out.join('')
  }
}
