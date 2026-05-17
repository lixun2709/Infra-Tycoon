import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PerformanceMonitor } from '../PerformanceMonitor'

describe('Performance Tooling & Telemetry Subsystem', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    // Construct a new instance to run isolated tests without polluting global singleton
    monitor = new PerformanceMonitor()
  })

  it('should successfully update and aggregate simulation telemetry and ECS cached evaluates', () => {
    const sysTimings = {
      ThermalSystem: 0.154,
      PowerSystem: 0.089
    }

    const queryTelemetry = {
      activeQueries: 4,
      queryHits: 390,
      queryMisses: 10,
      cacheHitRatio: 0.975
    }

    monitor.updateSimMetrics(1.248, 1500, sysTimings, queryTelemetry)

    const metrics = monitor.getMetrics()
    expect(metrics.simTickTime).toBe(1.248)
    expect(metrics.entityCount).toBe(1500)
    expect(metrics.systemTimings).toEqual(sysTimings)
    expect(metrics.activeQueries).toBe(4)
    expect(metrics.queryHits).toBe(390)
    expect(metrics.queryMisses).toBe(10)
    expect(metrics.cacheHitRatio).toBe(0.975)
    expect(metrics.workerStatus).toBe('online')
  })

  it('should successfully register real-time Three.js WebGLRenderer draw call and memory statistics', () => {
    // Simulate updating Three.js statistics
    monitor.updateRenderMetrics(85, 25600, 12, 6)

    const metrics = monitor.getMetrics()
    expect(metrics.drawCalls).toBe(85)
    expect(metrics.triangles).toBe(25600)
    expect(metrics.geometries).toBe(12)
    expect(metrics.textures).toBe(6)
  })

  it('should fallback gracefully when Chromium memory statistics API is not supported', () => {
    // Ensure memory statistics default to undefined if not in a Chromium browser
    const metrics = monitor.getMetrics()
    expect(metrics.usedJSHeapSize).toBeUndefined()
    expect(metrics.totalJSHeapSize).toBeUndefined()
    expect(metrics.jsHeapSizeLimit).toBeUndefined()
  })

  it('should track multiplayer latency and packet loss metrics', () => {
    monitor.updateNetworkMetrics(42.5, 0.012)

    const metrics = monitor.getMetrics()
    expect(metrics.networkLatency).toBe(42.5)
    expect(metrics.packetLoss).toBe(0.012)
  })
})
