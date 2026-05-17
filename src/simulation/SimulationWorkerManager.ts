import type { SimMessage, SimSyncOutputPayload, SimTelemetryPayload, SimInitPayload, SimSyncInputPayload } from './worker/workerTypes'
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
  private heartbeatInterval: number | null = null
  private lastNodes: InfraNode[] = []
  private lastApps: ApplicationDeployment[] = []
  
  private restartAttempts = 0
  private maxRestartAttempts = 5
  private isRestarting = false

  // Backpressure Metrics
  private droppedTicksCount = 0
  private successfulTicksCount = 0

  constructor() {
    interface GlobalWithProcess {
      process?: {
        env?: {
          VITEST?: string
        }
      }
    }
    const isVitest = typeof globalThis !== 'undefined' && (globalThis as unknown as GlobalWithProcess).process?.env?.VITEST
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !isVitest) {
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
      let msgData = event.data
      if (msgData.payload instanceof ArrayBuffer) {
        try {
          const decoder = new TextDecoder()
          const jsonStr = decoder.decode(new Uint8Array(msgData.payload))
          msgData = { ...msgData, payload: JSON.parse(jsonStr) }
        } catch (err) {
          console.error('[[WorkerManager]] Error decoding transferable payload:', err)
        }
      }

      const { type, payload } = msgData
      
      switch (type) {
        case 'PONG':
          this.lastHeartbeatTime = Date.now()
          if (Math.random() > 0.9) console.log('[[WorkerManager]] Heartbeat PONG received (sampled)')
          break

        case 'SYNC_OUTPUT': {
          this.isProcessingTick = false
          const latency = performance.now() - this.lastTickRequestTime
          performanceMonitor.updateWorkerLatency(latency)
          if (this.onOutputCallback) this.onOutputCallback(payload as SimSyncOutputPayload)
          break
        }

        case 'TELEMETRY': {
          const t = payload as SimTelemetryPayload
          performanceMonitor.updateSimMetrics(t.tickDurationMs, t.entityCount, t.systemTimings, t.queryTelemetry)
          if (this.onTelemetryCallback) this.onTelemetryCallback(t)
          break
        }
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

  private compactState(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    const start = performance.now()
    const compactNodes = nodes.map(n => ({
      id: n.id,
      type: n.type,
      siteId: n.siteId,
      parentRackId: n.parentRackId,
      slotIndex: n.slotIndex,
      wattage: n.wattage ?? 0,
      currentPowerKW: n.currentPowerKW,
      systemState: n.systemState,
      provisioningState: n.provisioningState,
      bootProgress: n.bootProgress ?? 0,
      temperature: n.temperature,
      isThrottled: n.isThrottled,
      btuOutput: n.btuOutput ?? 0
    }))

    const compactApps = applications.map(a => ({
      id: a.id,
      appId: a.appId,
      nodeId: a.nodeId,
      status: a.status,
      progress: a.progress
    }))

    const compacted = { nodes: compactNodes, applications: compactApps }
    const timeMs = performance.now() - start
    const approxBytes = JSON.stringify(compacted).length

    if (Math.random() > 0.95) {
      console.log(`[[WorkerManager Telemetry]] Serialization Compaction: ${approxBytes} bytes in ${timeMs.toFixed(3)}ms`)
    }

    return compacted
  }

  public init(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    this.lastNodes = nodes
    this.lastApps = applications
    const compacted = this.compactState(nodes, applications)
    this.sendTransferable('INIT', compacted)
    this.restartAttempts = 0 // Reset on successful user-triggered init
  }

  public syncInput(nodes: InfraNode[], applications: ApplicationDeployment[]) {
    this.lastNodes = nodes
    this.lastApps = applications
    const compacted = this.compactState(nodes, applications)
    this.sendTransferable('SYNC_INPUT', compacted)
  }

  public requestTick() {
    if (!this.worker || this.isRestarting) return 
    if (this.isProcessingTick) {
      this.droppedTicksCount++
      return
    }
    this.isProcessingTick = true
    this.successfulTicksCount++
    this.lastTickRequestTime = performance.now()
    this.send('TICK')
  }

  public getBackpressureMetrics() {
    return {
      droppedTicks: this.droppedTicksCount,
      successfulTicks: this.successfulTicksCount,
      backpressureRatio: this.droppedTicksCount + this.successfulTicksCount > 0
        ? this.droppedTicksCount / (this.droppedTicksCount + this.successfulTicksCount)
        : 0
    }
  }

  public onOutput(callback: (payload: SimSyncOutputPayload) => void) {
    this.onOutputCallback = callback
  }

  public onTelemetry(callback: (payload: SimTelemetryPayload) => void) {
    this.onTelemetryCallback = callback
  }

  private send(type: 'INIT', payload: SimInitPayload): void
  private send(type: 'SYNC_INPUT', payload: SimSyncInputPayload): void
  private send(type: 'TICK'): void
  private send(type: 'PING'): void
  private send(type: string, payload?: unknown) {
    if (this.worker) {
      this.worker.postMessage({ type, payload })
    }
  }

  private sendTransferable(type: string, payload: unknown) {
    if (!this.worker) return
    try {
      const jsonStr = JSON.stringify(payload)
      const encoder = new TextEncoder()
      const uint8 = encoder.encode(jsonStr)
      const buffer = uint8.buffer
      this.worker.postMessage({ type, payload: buffer }, [buffer])
    } catch (err) {
      console.warn('[[WorkerManager]] Fallback to structural clone for send:', err)
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
