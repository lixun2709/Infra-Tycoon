import { describe, it, expect, beforeEach } from 'vitest'
import { useInfraStore } from '../store/useInfraStore'
import { InputProcessor } from '../systems/interaction/InputProcessor'
import { InteractionTelemetry } from '../systems/interaction/InteractionTelemetry'

describe('Interaction Subsystem Core Math, State & Observability Tests', () => {
  beforeEach(() => {
    useInfraStore.getState().resetState()
    InputProcessor.getInstance().clearQueue()
    InteractionTelemetry.clearLogs()
  })

  describe('FIFO Intent Processor Queue', () => {
    it('should enqueue and process simple selection intents', () => {
      const processor = InputProcessor.getInstance()
      expect(processor.getQueueLength()).toBe(0)

      processor.enqueueIntent({
        type: 'SELECT_NODE',
        payload: { nodeId: 'rack-01', nodeType: 'RACK' }
      })

      const state = useInfraStore.getState()
      expect(state.selectedNodeId).toBe('rack-01')
      expect(state.interactionMode).toBe('SELECTING')
      expect(processor.getQueueLength()).toBe(0)
    })

    it('should transition modes on cancellation intent', () => {
      const processor = InputProcessor.getInstance()
      
      // Select first
      processor.enqueueIntent({
        type: 'SELECT_NODE',
        payload: { nodeId: 'node-01', nodeType: 'NODE' }
      })
      expect(useInfraStore.getState().selectedNodeId).toBe('node-01')
      expect(useInfraStore.getState().interactionMode).toBe('SELECTING')

      // Cancel/Deselect
      processor.enqueueIntent({ type: 'DESELECT_NODE' })
      expect(useInfraStore.getState().selectedNodeId).toBeNull()
      expect(useInfraStore.getState().interactionMode).toBe('IDLE')
    })

    it('should buffer multiple intents and execute them in order', () => {
      const processor = InputProcessor.getInstance()
      
      processor.enqueueIntent({
        type: 'SELECT_NODE',
        payload: { nodeId: 'node-01', nodeType: 'NODE' }
      })
      
      processor.enqueueIntent({
        type: 'CHANGE_MODE',
        payload: { mode: 'WIRING' }
      })

      const state = useInfraStore.getState()
      expect(state.interactionMode).toBe('WIRING')
      expect(InteractionTelemetry.getActionCount()).toBe(2)
    })
  })

  describe('Circular Observability Telemetry Ring Buffer', () => {
    it('should cap logs within circular boundary of 200 entries', () => {
      const store = useInfraStore.getState()
      
      for (let i = 0; i < 250; i++) {
        store.logInteractionEvent(`User action ${i}`)
      }

      const logs = InteractionTelemetry.getLogs()
      expect(logs.length).toBe(200)
      expect(logs[0]).toBe('User action 50')
      expect(logs[199]).toBe('User action 249')
    })

    it('should serialize diagnostic JSON strings cleanly', () => {
      const store = useInfraStore.getState()
      store.logInteractionEvent('Operator click')
      
      const payload = InteractionTelemetry.serializeTelemetry()
      const data = JSON.parse(payload)
      
      expect(data).toHaveProperty('mode')
      expect(data).toHaveProperty('logCount')
      expect(data.logCount).toBe(1)
    })
  })
})
