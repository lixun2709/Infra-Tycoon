import { useInfraStore } from '../../store/useInfraStore'
import { performanceMonitor } from '../PerformanceMonitor'

export class PrometheusExporter {
  /**
   * Helper to write standard Prometheus metric metadata.
   */
  private static metricHelp(name: string, type: 'gauge' | 'counter', help: string): string {
    return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n`
  }

  /**
   * Generates a fully formatted Prometheus exposition format string of the simulation state.
   */
  public static exportMetrics(): string {
    const store = useInfraStore.getState()
    const metrics = performanceMonitor.getMetrics()
    let out = ''

    // 1. Host Performance Metrics
    out += this.metricHelp('infra_tycoon_fps', 'gauge', 'Main thread frames per second.')
    out += `infra_tycoon_fps ${metrics.fps}\n\n`

    out += this.metricHelp('infra_tycoon_frame_time_ms', 'gauge', 'Main thread frame update duration in milliseconds.')
    out += `infra_tycoon_frame_time_ms ${metrics.frameTime.toFixed(3)}\n\n`

    out += this.metricHelp('infra_tycoon_frame_jitter_ms', 'gauge', 'Frame update delay jitter variance in milliseconds.')
    out += `infra_tycoon_frame_jitter_ms ${(metrics.frameJitter ?? 0.0).toFixed(3)}\n\n`

    out += this.metricHelp('infra_tycoon_js_heap_bytes', 'gauge', 'JS engine memory allocation details.')
    out += `infra_tycoon_js_heap_bytes{type="used"} ${metrics.usedJSHeapSize ?? 0}\n`
    out += `infra_tycoon_js_heap_bytes{type="total"} ${metrics.totalJSHeapSize ?? 0}\n`
    out += `infra_tycoon_js_heap_bytes{type="limit"} ${metrics.jsHeapSizeLimit ?? 0}\n\n`

    // 2. Web Worker Simulation Thread Diagnostics
    out += this.metricHelp('infra_tycoon_worker_tick_duration_ms', 'gauge', 'Background simulation cycle calculation time in milliseconds.')
    out += `infra_tycoon_worker_tick_duration_ms ${metrics.simTickTime.toFixed(4)}\n\n`

    out += this.metricHelp('infra_tycoon_worker_latency_ms', 'gauge', 'Message roundtrip latency between main and worker threads.')
    out += `infra_tycoon_worker_latency_ms ${metrics.workerLatency.toFixed(2)}\n\n`

    out += this.metricHelp('infra_tycoon_worker_backpressure_ratio', 'gauge', 'Active worker queue backpressure load index.')
    out += `infra_tycoon_worker_backpressure_ratio ${(metrics.backpressureRatio ?? 0.0).toFixed(4)}\n\n`

    out += this.metricHelp('infra_tycoon_worker_dropped_ticks_total', 'counter', 'Total simulation ticks dropped due to queue congestion.')
    out += `infra_tycoon_worker_dropped_ticks_total ${metrics.droppedTicks ?? 0}\n\n`

    // 3. ECS Core Metrics
    out += this.metricHelp('infra_tycoon_ecs_entities_total', 'gauge', 'Total active registered entities inside ECS simulation world.')
    out += `infra_tycoon_ecs_entities_total ${metrics.entityCount}\n\n`

    out += this.metricHelp('infra_tycoon_ecs_cache_hit_ratio', 'gauge', 'Entity query cache hit ratio index.')
    out += `infra_tycoon_ecs_cache_hit_ratio ${metrics.cacheHitRatio.toFixed(4)}\n\n`

    // 4. WebGL Render pipeline
    out += this.metricHelp('infra_tycoon_webgl_draw_calls_total', 'gauge', 'Three.js pipeline draw calls per frame.')
    out += `infra_tycoon_webgl_draw_calls_total ${metrics.drawCalls}\n\n`

    out += this.metricHelp('infra_tycoon_webgl_triangles_total', 'gauge', 'WebGL pipeline triangles count per frame.')
    out += `infra_tycoon_webgl_triangles_total ${metrics.triangles}\n\n`

    // 5. Deterministic Operational Metrics (Day 35 Stats)
    if (metrics.simStats) {
      const stats = metrics.simStats
      out += this.metricHelp('infra_tycoon_sim_uptime_ratio', 'gauge', 'Average operational hardware uptime ratio.')
      out += `infra_tycoon_sim_uptime_ratio ${stats.averageUptimeRatio.toFixed(4)}\n\n`

      out += this.metricHelp('infra_tycoon_sim_power_draw_kw', 'gauge', 'Total power wattage loaded across server chassis.')
      out += `infra_tycoon_sim_power_draw_kw ${stats.totalPowerDrawKW.toFixed(3)}\n\n`

      out += this.metricHelp('infra_tycoon_sim_hotspots_total', 'gauge', 'Chassis nodes running above critical temperature thresholds.')
      out += `infra_tycoon_sim_hotspots_total ${stats.overheatedNodeCount}\n\n`

      out += this.metricHelp('infra_tycoon_sim_congested_links_total', 'gauge', 'Overburdened high-density network fiber lines.')
      out += `infra_tycoon_sim_congested_links_total ${stats.congestedLinkCount}\n\n`

      out += this.metricHelp('infra_tycoon_sim_storage_bytes', 'gauge', 'Summed storage utilization and limit specs.')
      out += `infra_tycoon_sim_storage_bytes{type="used"} ${(stats.totalStorageUsedTB * 1e12).toFixed(0)}\n`
      out += `infra_tycoon_sim_storage_bytes{type="capacity"} ${(stats.totalStorageCapacityTB * 1e12).toFixed(0)}\n\n`
    }

    // 6. Global Tycoon State (Zustand Store)
    out += this.metricHelp('infra_tycoon_balance_dollars', 'gauge', 'Current capital balance of the operating corporation.')
    out += `infra_tycoon_balance_dollars ${store.balance}\n\n`

    out += this.metricHelp('infra_tycoon_reputation_percent', 'gauge', 'Contractual reliability index representing operational SLA trust.')
    out += `infra_tycoon_reputation_percent ${store.reputation}\n\n`

    out += this.metricHelp('infra_tycoon_alerts_total', 'gauge', 'Active unacknowledged operations incidents.')
    out += `infra_tycoon_alerts_total ${store.alerts.filter(a => !a.isAcknowledged).length}\n`

    return out
  }
}
