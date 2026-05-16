import type { SimMessage, SimSyncOutputPayload, SimTelemetryPayload } from './worker/workerTypes'
import type { InfraNode, ApplicationDeployment } from '../store/infraTypes'
import { performanceMonitor } from './PerformanceMonitor'

/**
 * SimulationWorkerManager
 * Handles communication with the background simulation worker with resilience.
 */
export class SimulationWorkerManager {
  private worker: Worker | null = null
  private onOutputCallback: ((payload: SimSyncOutputPayload) => void) | null = null
  private onTelemetryCallback: ((payload: SimTelemetryPayload) => void) | null = null
  
  private isProcessingTick = false
  private lastTickRequestTime = 0
  
  private lastHeartbeatTime = 0
  private heartbeatInterval: any = null
  private lastNodes: InfraNode[] = []
  private lastApps: ApplicationDeployment[] = []
  
  private restartAttempts = 0
  private maxRestartAttempts = 5
  private isRestarting = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.start()
    }
  }

  public start() {
    console.log('[[WorkerManager]] Initializing Simulation Worker...')
    this.worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), {
      type: 'module'
    })
    this.initWorker()
    this.startHeartbeat()
    this.isRestarting = false
    performanceMonitor.setWorkerStatus('online')
  }

  private initWorker() {
    if (!this.worker) return

    this.worker.onmessage = (event: MessageEvent<SimMessage>) => {
      const { type, payload } = event.data
      
      switch (type) {
        case 'PONG':
          this.lastHeartbeatTime = Date.now()
          if (Math.random() > 0.9) console.log('[[WorkerManager]] Heartbeat PONG received (sampled)')
          break

        case 'SYNC_OUTPUT':
          this.isProcessingTick = false
          const latency = performance.now() - this.lastTickRequestTime
          performanceMonitor.updateWorkerLatency(latency)
          if (this.onOutputCallback) this.onOutputCallback(payload)
          break

        case 'TELEMETRY':
          const t = payload as SimTelemetryPayload
          performanceMonitor.updateSimMetrics(t.tickDurationMs, t.entityCount, t.systemTimings)
          if (this.onTelemetryCallback) this.onTelemetryCallback(t)
          break
      }
    }

    this.worker.onerror = (error) => {
      console.error('[[WorkerManager]] Worker Error detected:', error)
      this.handleWorkerFailure()
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    
    this.lastHeartbeatTime = Date.now()
    this.heartbeatInterval = setInterval(() => {
      if (!this.worker || this.isRestarting) return

      // If no PONG for 5 seconds, consider it hung
      if (Date.now() - this.lastHeartbeatTime > 5000) {
        console.warn('[[WorkerManager]] Heartbeat timeout! Worker unresponsive.')
        this.handleWorkerFailure()
        return
      }

      this.send('PING')
      if (Math.random() > 0.9) console.log('[[WorkerManager]] Heartbeat PING sent (sampled)')
    }, 2000)
  }

  private handleWorkerFailure() {
    if (this.isRestarting) return
    this.isRestarting = true
    
    console.warn(`[[WorkerManager]] Initiating worker restart (Attempt ${this.restartAttempts + 1}/${this.maxRestartAttempts})...`)
    performanceMonitor.setWorkerStatus('restarting')
    
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++
      setTimeout(() => {
        this.start()
        // Re-initialize with last known state
        if (this.lastNodes.length > 0) {
          this.init(this.lastNodes, this.lastApps)
        }
      }, 1000 * this.restartAttempts) // Exponential backoff-ish
    } else {
      performanceMonitor.setWorkerStatus('failed')
      console.error('[[WorkerManager]] Critical: Max restart attempts reached. Simulation halted.')
    }
  }

  public init(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    this.lastNodes = nodes
    this.lastApps = applications
    this.send('INIT', { nodes, applications })
    this.restartAttempts = 0 // Reset on successful user-triggered init
  }

  public syncInput(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    this.lastNodes = nodes
    this.lastApps = applications
    this.send('SYNC_INPUT', { nodes, applications })
  }

  public requestTick() {
    if (this.isProcessingTick || !this.worker || this.isRestarting) return 
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

  public terminate() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}

export const simWorkerManager = new SimulationWorkerManager()
