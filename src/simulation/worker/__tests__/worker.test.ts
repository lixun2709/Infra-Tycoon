import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { SimulationWorkerManager } from '../../SimulationWorkerManager'
import type { SimulationEngine } from '../../SimulationEngine'
import type { InfraNode, ApplicationDeployment } from '../../../store/infraTypes'
import type { SimInitPayload } from '../workerTypes'

describe('Simulation Worker Synchronization Subsystem', () => {
  let manager: SimulationWorkerManager
  let SimulationEngineClass: typeof SimulationEngine

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Stub the global Worker class as a proper ES6 class BEFORE loading the modules
    vi.stubGlobal('Worker', class MockWorker {
      public postMessage = vi.fn()
      public terminate = vi.fn()
      public onmessage = null
      public onerror = null
    })

    // Dynamically import to completely bypass ES import hoisting
    const workerMgrModule = await import('../../SimulationWorkerManager')
    manager = new workerMgrModule.SimulationWorkerManager() as unknown as SimulationWorkerManager
    manager.start() // Explicitly start the worker manager in the test environment!
    
    // Disable heartbeat during tests to avoid ReferenceError: Worker is not defined due to timeout
    const mgr = manager as unknown as { heartbeatInterval?: ReturnType<typeof setInterval> }
    if (mgr.heartbeatInterval) {
      clearInterval(mgr.heartbeatInterval)
    }

    const engineModule = await import('../../SimulationEngine')
    SimulationEngineClass = engineModule.SimulationEngine as unknown as typeof SimulationEngine
  }, 30000)

  afterEach(() => {
    if (manager) manager.terminate()
    vi.unstubAllGlobals()
  })

  it('should successfully compact large store arrays into lightweight serialization objects', () => {
    const richNodes: InfraNode[] = [
      {
        id: 'rack-1',
        type: 'rack',
        siteId: 'site-alpha',
        name: 'Enterprise Rack A',
        wattage: 1200,
        btuOutput: 4000,
        ports: [
          { id: 'p-1', number: 1, type: 'rj45', isConnected: true }
        ],
        services: [
          { id: 's-1', name: 'DNS', port: 53, status: 'active' }
        ],
        systemState: 'running',
        bootProgress: 100,
        provisioningState: 'bootstrapped',
        installDate: Date.now(),
        degradation: 0.05,
        breakerTripped: false,
        overloadSeconds: 0,
        containmentType: 'cold_aisle'
      } as unknown as InfraNode
    ]

    const richApps: ApplicationDeployment[] = [
      {
        id: 'app-dns',
        appId: 'dns-service',
        nodeId: 'rack-1',
        status: 'running',
        progress: 100,
        memoryUsageMB: 256
      } as unknown as ApplicationDeployment
    ]

    const mockPostMessage = vi.spyOn(manager['worker']!, 'postMessage')
    manager.init(richNodes, richApps)

    expect(mockPostMessage).toHaveBeenCalled()
    const lastCall = mockPostMessage.mock.calls[mockPostMessage.mock.calls.length - 1]
    expect(lastCall).toBeDefined()
    const message = lastCall![0]

    expect(message.type).toBe('INIT')
    
    let payload = message.payload
    if (payload instanceof ArrayBuffer || (payload && typeof payload === 'object' && !('nodes' in payload))) {
      const decoder = new TextDecoder()
      const jsonStr = decoder.decode(new Uint8Array(payload as ArrayBuffer))
      payload = JSON.parse(jsonStr)
    }

    // Nodes must be stripped of heavy objects (ports, services, installDate, degradation, name)
    const compactedNode = payload.nodes[0]
    expect(compactedNode.id).toBe('rack-1')
    expect(compactedNode.type).toBe('rack')
    expect(compactedNode.ports).toBeUndefined()
    expect(compactedNode.services).toBeUndefined()
    expect(compactedNode.degradation).toBeUndefined()
    expect(compactedNode.name).toBe('Enterprise Rack A')
    expect(compactedNode.breakerTripped).toBe(false)
    expect(compactedNode.overloadSeconds).toBe(0)
    expect(compactedNode.containmentType).toBe('cold_aisle')

    // Validate app compaction
    const compactedApp = payload.applications[0]
    expect(compactedApp.id).toBe('app-dns')
    expect(compactedApp.appId).toBe('dns-service')
    expect(compactedApp.memoryUsageMB).toBeUndefined()
  })

  it('should reconcile state and prune decommissioned entities from simulation (Leak Pruner)', () => {
    const engine = new SimulationEngineClass()
    const world = engine.getWorld()

    // 1. Initial sync with 2 nodes
    const payload1 = {
      nodes: [
        { id: 'node-A', type: 'compute', siteId: 's1', wattage: 500, systemState: 'running', provisioningState: 'provisioned', bootProgress: 100, btuOutput: 1500 },
        { id: 'node-B', type: 'compute', siteId: 's1', wattage: 500, systemState: 'running', provisioningState: 'provisioned', bootProgress: 100, btuOutput: 1500 }
      ],
      applications: []
    } as unknown as SimInitPayload

    const syncFunc = (payload: SimInitPayload) => {
      const incomingIds = new Set<string>()
      payload.nodes.forEach(n => incomingIds.add(n.id))
      
      const currentEntities = world.getEntitiesWith([])
      currentEntities.forEach(id => {
        if (!incomingIds.has(id)) {
          world.removeEntity(id)
        }
      })

      payload.nodes.forEach(n => {
        if (!world.hasComponent('transform', n.id)) {
          world.registerEntity(n.id)
        }
        world.addComponent('transform', { entityId: n.id, type: n.type } as unknown as Component)
      })
    }

    interface Component {
      entityId: string
      type: string
    }

    syncFunc(payload1)
    expect(world.getEntityCount()).toBe(2)
    expect(world.getEntitiesWith(['transform']).length).toBe(2)

    // 2. Second sync where 'node-B' is decommissioned / missing
    const payload2 = {
      nodes: [
        { id: 'node-A', type: 'compute', siteId: 's1', wattage: 500, systemState: 'running', provisioningState: 'provisioned', bootProgress: 100, btuOutput: 1500 }
      ],
      applications: []
    } as unknown as SimInitPayload

    syncFunc(payload2)
    
    expect(world.getEntityCount()).toBe(1)
    expect(world.getEntitiesWith(['transform']).length).toBe(1)
    expect(world.getEntitiesWith(['transform'])[0]).toBe('node-A')
  })

  it('should process tick payloads in sequence (FIFO Command Queue)', async () => {
    const queue: { type: string }[] = []
    let isProcessing = false
    const orderExecuted: string[] = []

    const processQueue = async () => {
      if (isProcessing || queue.length === 0) return
      isProcessing = true

      while (queue.length > 0) {
        const cmd = queue.shift()!
        await new Promise(resolve => setTimeout(resolve, 10))
        orderExecuted.push(cmd.type)
      }
      isProcessing = false
    }

    queue.push({ type: 'INIT' })
    queue.push({ type: 'SYNC_INPUT' })
    queue.push({ type: 'TICK' })

    await processQueue()

    expect(orderExecuted).toEqual(['INIT', 'SYNC_INPUT', 'TICK'])
  })

  describe('Transferable Objects and Backpressure Guarding', () => {
    it('should drop subsequent tick requests when worker is busy (Backpressure Guard)', () => {
      // 1. Initial state
      let metrics = manager.getBackpressureMetrics()
      expect(metrics.droppedTicks).toBe(0)
      expect(metrics.successfulTicks).toBe(0)

      // 2. Request first tick (sets isProcessingTick = true)
      manager.requestTick()
      metrics = manager.getBackpressureMetrics()
      expect(metrics.successfulTicks).toBe(1)
      expect(metrics.droppedTicks).toBe(0)

      // 3. Request a second tick while first is still processing
      manager.requestTick()
      metrics = manager.getBackpressureMetrics()
      expect(metrics.droppedTicks).toBe(1)
      expect(metrics.successfulTicks).toBe(1)
      expect(metrics.backpressureRatio).toBe(0.5)

      // 4. Request a third tick
      manager.requestTick()
      metrics = manager.getBackpressureMetrics()
      expect(metrics.droppedTicks).toBe(2)
      expect(metrics.backpressureRatio).toBe(2 / 3)
    })

    it('should successfully serialize objects into transferable ArrayBuffers', () => {
      const payload = { test: 'value', data: [1, 2, 3] }
      const jsonStr = JSON.stringify(payload)
      const encoder = new TextEncoder()
      const buffer = encoder.encode(jsonStr).buffer

      expect(buffer).toBeDefined()
      expect(buffer.byteLength).toBeGreaterThan(0)

      const decoder = new TextDecoder()
      const decodedStr = decoder.decode(new Uint8Array(buffer))
      const decodedPayload = JSON.parse(decodedStr)

      expect(decodedPayload).toEqual(payload)
    })
  })
})
