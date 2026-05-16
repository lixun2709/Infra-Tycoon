import type { SimMessage, SimSyncOutputPayload, SimTelemetryPayload } from './worker/workerTypes'
import type { InfraNode, ApplicationDeployment } from '../store/infraTypes'
import { performanceMonitor } from './PerformanceMonitor'


/**
 * SimulationWorkerManager
 * Handles communication with the background simulation worker.
 */
export class SimulationWorkerManager {
  private worker: Worker | null = null
  private onOutputCallback: ((payload: SimSyncOutputPayload) => void) | null = null
  private onTelemetryCallback: ((payload: SimTelemetryPayload) => void) | null = null
  private isProcessingTick = false
  private lastTickRequestTime = 0

  constructor() {
    if (typeof window !== 'undefined') {
      console.log('[[Main Thread]] Initializing Simulation Worker...')
      this.worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), {
        type: 'module'
      })
      this.initWorker()
    }
  }

  private initWorker() {
    if (this.worker) {
      console.log('[[Main Thread]] Worker instance created, setting up message handler.')
      this.worker.onmessage = (event: MessageEvent<SimMessage>) => {
        const { type, payload } = event.data
        
        if (type === 'SYNC_OUTPUT') {
          this.isProcessingTick = false
          const latency = performance.now() - this.lastTickRequestTime
          performanceMonitor.updateWorkerLatency(latency)
          
          if (this.onOutputCallback) this.onOutputCallback(payload)
        } else if (type === 'TELEMETRY') {
          const t = payload as SimTelemetryPayload
          performanceMonitor.updateSimMetrics(t.tickDurationMs, t.entityCount, t.systemTimings)
          
          if (this.onTelemetryCallback) this.onTelemetryCallback(t)
        }
      }
    } else {
      console.error('Failed to locate simulation.worker.ts')
    }
  }

  public init(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    this.send('INIT', { nodes, applications })
  }

  public syncInput(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    this.send('SYNC_INPUT', { nodes, applications })
  }

  public requestTick() {
    if (this.isProcessingTick) return // Prevent congestion
    this.isProcessingTick = true
    this.lastTickRequestTime = performance.now()
    this.send('TICK')
  }

  public onOutput(callback: (payload: SimSyncOutputPayload) => void) {
    this.onOutputCallback = callback
  }

  public onTelemetry(callback: (payload: SimTelemetryPayload) => void) {
    this.onTelemetryCallback = callback
  }

  private send(type: any, payload?: any) {
    if (this.worker) {
      this.worker.postMessage({ type, payload })
    }
  }
}

// Singleton instance
export const simWorkerManager = new SimulationWorkerManager()
