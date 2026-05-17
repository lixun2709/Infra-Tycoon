import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { simulationCoordinator, type SimEvent } from '../SimulationCoordinator'
import { useInfraStore } from '../../store/useInfraStore'

vi.mock('../../store/useInfraStore', () => {
  const mockState = {
    simulationCycle: 42,
    processTick: vi.fn(),
  }
  return {
    useInfraStore: {
      getState: () => mockState,
    },
  }
})

describe('SimulationCoordinator Subsystem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    simulationCoordinator.stop()
    vi.mocked(useInfraStore.getState().processTick).mockClear()
  })

  afterEach(() => {
    simulationCoordinator.stop()
    vi.useRealTimers()
  })

  it('should initialize with offline state', () => {
    expect(simulationCoordinator.isRunning()).toBe(false)
    expect(simulationCoordinator.getLastTickDurationMs()).toBe(0)
  })

  it('should trigger STATUS_CHANGE event when started and stopped', () => {
    const events: SimEvent[] = []
    const unsub = simulationCoordinator.addListener((e) => events.push(e))

    simulationCoordinator.start(1000)
    expect(simulationCoordinator.isRunning()).toBe(true)
    expect(events).toContainEqual({ type: 'STATUS_CHANGE', running: true })

    simulationCoordinator.stop()
    expect(simulationCoordinator.isRunning()).toBe(false)
    expect(events).toContainEqual({ type: 'STATUS_CHANGE', running: false })

    unsub()
  })

  it('should run ticks periodically and emit TICK_START and TICK_END events', () => {
    const events: SimEvent[] = []
    const unsub = simulationCoordinator.addListener((e) => events.push(e))

    simulationCoordinator.start(2000)

    // Advance clock to trigger 1 tick
    vi.advanceTimersByTime(2000)

    expect(useInfraStore.getState().processTick).toHaveBeenCalledTimes(1)
    expect(events.some(e => e.type === 'TICK_START' && e.cycle === 42)).toBe(true)
    expect(events.some(e => e.type === 'TICK_END' && e.cycle === 42)).toBe(true)

    unsub()
  })

  it('should catch execution errors gracefully and emit ERROR events', () => {
    vi.mocked(useInfraStore.getState().processTick).mockImplementationOnce(() => {
      throw new Error('Simulation Crash Test')
    })

    const events: SimEvent[] = []
    const unsub = simulationCoordinator.addListener((e) => events.push(e))

    simulationCoordinator.start(2000)
    vi.advanceTimersByTime(2000)

    expect(events.some(e => e.type === 'ERROR' && e.message === 'Simulation Crash Test')).toBe(true)

    unsub()
  })
})
