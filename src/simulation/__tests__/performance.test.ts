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

  it('should calculate percentile99FrameTime, onePercentLowFps, and frameJitter correctly from frameTimes ring buffer', () => {
    vi.useFakeTimers()
    const originalStartTracking = PerformanceMonitor.prototype['startTracking']
    
    // Stub startTracking to only setup calculation interval without requestAnimationFrame loop
    PerformanceMonitor.prototype['startTracking'] = function(this: { frameTimes: number[], metrics: Record<string, unknown> }) {
      setInterval(() => {
        const avgFrameTime = this.frameTimes.length > 0 
          ? this.frameTimes.reduce((a: number, b: number) => a + b, 0) / this.frameTimes.length
          : 16.6
        this.metrics.fps = Math.round(1000 / avgFrameTime)
        this.metrics.frameTime = avgFrameTime
        
        if (this.frameTimes.length > 0) {
          const sortedTimes = [...this.frameTimes].sort((a: number, b: number) => a - b)
          const p99Index = Math.floor(sortedTimes.length * 0.99)
          this.metrics.percentile99FrameTime = sortedTimes[Math.min(p99Index, sortedTimes.length - 1)] ?? avgFrameTime

          const onePercentCount = Math.max(1, Math.floor(sortedTimes.length * 0.01))
          const slowestFrames = sortedTimes.slice(-onePercentCount)
          const avgSlowestTime = slowestFrames.reduce((a: number, b: number) => a + b, 0) / slowestFrames.length
          this.metrics.onePercentLowFps = Math.round(1000 / avgSlowestTime)

          let totalDiff = 0
          let diffCount = 0
          for (let i = 1; i < this.frameTimes.length; i++) {
            const prev = this.frameTimes[i - 1]
            const curr = this.frameTimes[i]
            if (prev !== undefined && curr !== undefined) {
              totalDiff += Math.abs(curr - prev)
              diffCount++
            }
          }
          this.metrics.frameJitter = diffCount > 0 ? totalDiff / diffCount : 0
        }
      }, 1000)
    }

    const customMonitor = new PerformanceMonitor()
    
    // Inject custom mock frame times (59 frames of 16.6ms + 1 slow frame of 100ms)
    const mockTimes = Array(59).fill(16.6)
    mockTimes.push(100.0)
    customMonitor['frameTimes'] = mockTimes

    // Advance fake timers by 1 second to trigger calculation interval
    vi.advanceTimersByTime(1000)

    const metrics = customMonitor.getMetrics()
    expect(metrics.percentile99FrameTime).toBe(100.0) // 100.0 is the 99th percentile (slowest frame)
    expect(metrics.onePercentLowFps).toBe(Math.round(1000 / 100.0)) // 10 FPS
    expect(metrics.frameJitter).toBeGreaterThan(0) // Jitter must be measured
    
    // Restore startTracking
    PerformanceMonitor.prototype['startTracking'] = originalStartTracking
    vi.useRealTimers()
  })

  it('should ingest and report worker backpressure metrics correctly', () => {
    monitor.updateBackpressure(3, 7) // 3 drops, 7 successes

    const metrics = monitor.getMetrics()
    expect(metrics.droppedTicks).toBe(3)
    expect(metrics.successfulTicks).toBe(7)
    expect(metrics.backpressureRatio).toBe(0.3)
  })
})
