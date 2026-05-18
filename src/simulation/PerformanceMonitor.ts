/**
 * PerformanceMonitor
 * Collects and aggregates performance metrics from simulation, memory, and rendering layers.
 */

export type WorkerStatus = 'online' | 'offline' | 'restarting' | 'failed'

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  simTickTime: number
  workerLatency: number
  workerStatus: WorkerStatus
  restartCount: number
  entityCount: number
  systemTimings: Record<string, number>
  lastUpdate: number
  // Memory diagnostics (Chromium performance.memory API)
  usedJSHeapSize?: number
  totalJSHeapSize?: number
  jsHeapSizeLimit?: number
  // Three.js Render stats
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  // ECS Cache telemetry
  activeQueries: number
  queryHits: number
  queryMisses: number
  cacheHitRatio: number
  // Multiplayer placeholders
  networkLatency: number
  packetLoss: number

  // Advanced Telemetry (Day 27)
  percentile99FrameTime: number
  onePercentLowFps: number
  frameJitter: number
  droppedTicks: number
  successfulTicks: number
  backpressureRatio: number

  // Deterministic Simulation Statistics (Day 35)
  simStats?: {
    averageUptimeRatio: number
    overheatedNodeCount: number
    congestedLinkCount: number
    totalPowerDrawKW: number
    totalStorageUsedTB: number
    totalStorageCapacityTB: number
  }
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    simTickTime: 0,
    workerLatency: 0,
    workerStatus: 'offline',
    restartCount: 0,
    entityCount: 0,
    systemTimings: {},
    lastUpdate: Date.now(),
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    activeQueries: 0,
    queryHits: 0,
    queryMisses: 0,
    cacheHitRatio: 0,
    networkLatency: 0,
    packetLoss: 0,
    percentile99FrameTime: 0,
    onePercentLowFps: 0,
    frameJitter: 0,
    droppedTicks: 0,
    successfulTicks: 0,
    backpressureRatio: 0,
    simStats: {
      averageUptimeRatio: 1.0,
      overheatedNodeCount: 0,
      congestedLinkCount: 0,
      totalPowerDrawKW: 0.0,
      totalStorageUsedTB: 0.0,
      totalStorageCapacityTB: 0.0
    }
  }

  private frameCount = 0
  private lastFrameTime = performance.now()
  private frameTimes: number[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.startTracking()
    }
  }

  private startTracking() {
    const loop = () => {
      const now = performance.now()
      const delta = now - this.lastFrameTime
      this.lastFrameTime = now
      this.frameTimes.push(delta)
      
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift()
      }

      this.frameCount++
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    // Calculate FPS and pull memory usage every second
    setInterval(() => {
      const avgFrameTime = this.frameTimes.length > 0 
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 16.6
      this.metrics.fps = Math.round(1000 / avgFrameTime)
      this.metrics.frameTime = avgFrameTime
      this.frameCount = 0

      // Calculate Percentiles & Jitter
      if (this.frameTimes.length > 0) {
        const sortedTimes = [...this.frameTimes].sort((a, b) => a - b)
        
        // 99th Percentile Frametime (slowest 1% boundary)
        const p99Index = Math.floor(sortedTimes.length * 0.99)
        this.metrics.percentile99FrameTime = sortedTimes[Math.min(p99Index, sortedTimes.length - 1)] ?? avgFrameTime

        // 1% Low FPS (average of the slowest 1% of frames)
        const onePercentCount = Math.max(1, Math.floor(sortedTimes.length * 0.01))
        const slowestFrames = sortedTimes.slice(-onePercentCount)
        const avgSlowestTime = slowestFrames.reduce((a, b) => a + b, 0) / slowestFrames.length
        this.metrics.onePercentLowFps = Math.round(1000 / avgSlowestTime)

        // Frame Jitter (average absolute difference between consecutive frames)
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
      } else {
        this.metrics.percentile99FrameTime = avgFrameTime
        this.metrics.onePercentLowFps = this.metrics.fps
        this.metrics.frameJitter = 0
      }

      interface ChromiumPerformance extends Performance {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }

      // Chromium memory API check
      if (typeof window !== 'undefined') {
        const perf = window.performance as ChromiumPerformance
        if (perf && perf.memory) {
          this.metrics.usedJSHeapSize = perf.memory.usedJSHeapSize
          this.metrics.totalJSHeapSize = perf.memory.totalJSHeapSize
          this.metrics.jsHeapSizeLimit = perf.memory.jsHeapSizeLimit
        }
      }
    }, 1000)
  }

  public updateSimMetrics(
    simTickTime: number, 
    entityCount: number, 
    systemTimings: Record<string, number>,
    queryTelemetry?: {
      activeQueries: number
      queryHits: number
      queryMisses: number
      cacheHitRatio: number
    },
    simStats?: {
      averageUptimeRatio: number
      overheatedNodeCount: number
      congestedLinkCount: number
      totalPowerDrawKW: number
      totalStorageUsedTB: number
      totalStorageCapacityTB: number
    }
  ) {
    this.metrics.simTickTime = simTickTime
    this.metrics.entityCount = entityCount
    this.metrics.systemTimings = systemTimings
    if (queryTelemetry) {
      this.metrics.activeQueries = queryTelemetry.activeQueries
      this.metrics.queryHits = queryTelemetry.queryHits
      this.metrics.queryMisses = queryTelemetry.queryMisses
      this.metrics.cacheHitRatio = queryTelemetry.cacheHitRatio
    }
    if (simStats) {
      this.metrics.simStats = simStats
    }
    this.metrics.lastUpdate = Date.now()
    this.metrics.workerStatus = 'online'
  }

  public updateRenderMetrics(drawCalls: number, triangles: number, geometries: number, textures: number) {
    this.metrics.drawCalls = drawCalls
    this.metrics.triangles = triangles
    this.metrics.geometries = geometries
    this.metrics.textures = textures
  }

  public updateWorkerLatency(latency: number) {
    this.metrics.workerLatency = latency
  }

  public setWorkerStatus(status: WorkerStatus) {
    this.metrics.workerStatus = status
    if (status === 'restarting') {
      this.metrics.restartCount++
    }
  }

  public updateNetworkMetrics(networkLatency: number, packetLoss: number) {
    this.metrics.networkLatency = networkLatency
    this.metrics.packetLoss = packetLoss
  }

  public updateBackpressure(droppedTicks: number, successfulTicks: number) {
    this.metrics.droppedTicks = droppedTicks
    this.metrics.successfulTicks = successfulTicks
    this.metrics.backpressureRatio = droppedTicks + successfulTicks > 0
      ? droppedTicks / (droppedTicks + successfulTicks)
      : 0
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }
}

export const performanceMonitor = new PerformanceMonitor()
