import { useInfraStore } from '../store/useInfraStore'

export type SimEvent = 
  | { type: 'TICK_START'; cycle: number }
  | { type: 'TICK_END'; cycle: number; durationMs: number }
  | { type: 'ERROR'; message: string }
  | { type: 'STATUS_CHANGE'; running: boolean }

export type SimListener = (event: SimEvent) => void

export class SimulationCoordinator {
  private isRunningState = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private listeners: Set<SimListener> = new Set()
  private tickRateMs = 1000
  private lastTickDurationMs = 0

  public addListener(listener: SimListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: SimEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (err) {
        console.error('[[SimulationCoordinator]] Listener threw exception:', err)
      }
    })
  }

  public start(tickRateMs = 1000): void {
    if (this.isRunningState) return
    this.tickRateMs = tickRateMs
    this.isRunningState = true
    
    this.emit({ type: 'STATUS_CHANGE', running: true })
    
    let lastTime = performance.now()
    const runLoop = () => {
      if (!this.isRunningState) return
      
      const now = performance.now()
      const dt = (now - lastTime) / 1000.0
      lastTime = now

      // Clamp delta time to stable physical limits to safeguard physics integration
      const clampedDt = Math.max(0.1, Math.min(2.0, dt))
      const seconds = Math.floor(useInfraStore.getState().realTimePlayedSeconds)
      this.emit({ type: 'TICK_START', cycle: seconds })
      
      const start = performance.now()
      try {
        useInfraStore.getState().processTick(clampedDt)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[[SimulationCoordinator]] Error in processTick execution:', err)
        this.emit({ type: 'ERROR', message: errMsg })
      }
      
      const duration = performance.now() - start
      this.lastTickDurationMs = duration
      this.emit({ type: 'TICK_END', cycle: seconds, durationMs: duration })
    }

    this.intervalId = setInterval(runLoop, this.tickRateMs)
    console.log(`[[SimulationCoordinator]] Simulation Engine loop active at ${this.tickRateMs}ms tickrate.`)
  }

  public stop(): void {
    if (!this.isRunningState) return
    this.isRunningState = false
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.emit({ type: 'STATUS_CHANGE', running: false })
    console.log('[[SimulationCoordinator]] Simulation Engine loop stopped.')
  }

  public isRunning(): boolean {
    return this.isRunningState
  }

  public getTickRateMs(): number {
    return this.tickRateMs
  }

  public getLastTickDurationMs(): number {
    return this.lastTickDurationMs
  }
}

export const simulationCoordinator = new SimulationCoordinator()
