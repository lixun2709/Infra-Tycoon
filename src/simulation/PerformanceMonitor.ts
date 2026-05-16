/**
 * PerformanceMonitor
 * Collects and aggregates performance metrics from simulation and rendering.
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
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    simTickTime: 0,
    workerLatency: 0,
    workerStatus: 'offline',
    restartCount: 0,
    entityCount: 0,
    systemTimings: {},
    lastUpdate: Date.now()
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

    // Calculate FPS every second
    setInterval(() => {
      const avgFrameTime = this.frameTimes.length > 0 
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 16.6
      this.metrics.fps = Math.round(1000 / avgFrameTime)
      this.metrics.frameTime = avgFrameTime
      this.frameCount = 0
    }, 1000)
  }

  public updateSimMetrics(simTickTime: number, entityCount: number, systemTimings: Record<string, number>) {
    this.metrics.simTickTime = simTickTime
    this.metrics.entityCount = entityCount
    this.metrics.systemTimings = systemTimings
    this.metrics.lastUpdate = Date.now()
    this.metrics.workerStatus = 'online'
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

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }
}

export const performanceMonitor = new PerformanceMonitor()
