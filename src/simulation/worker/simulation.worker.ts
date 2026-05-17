import { SimulationEngine } from '../SimulationEngine'
import type { SimMessage, SimInitPayload, SimSyncInputPayload, SimSyncOutputPayload } from './workerTypes'
import type { 
  ThermalComponent, 
  PowerComponent, 
  TransformComponent, 
  ProvisioningComponent, 
  ApplicationComponent 
} from '../ecs/types'

const engine = new SimulationEngine()
console.log('[[Worker Thread]] Simulation Worker Online')

// FIFO Command Queue for transaction/state synchronization safety
const commandQueue: SimMessage[] = []
let isProcessingQueue = false

self.onmessage = (event: MessageEvent<SimMessage>) => {
  const msg = event.data

  // Heartbeat PING is resolved immediately with low-latency priority
  if (msg.type === 'PING') {
    self.postMessage({ type: 'PONG' })
    return
  }

  commandQueue.push(msg)
  processQueue()
}

self.onerror = (e) => {
  console.error('[[Worker Thread]] Critical Worker Error:', e)
}

function processQueue() {
  if (isProcessingQueue || commandQueue.length === 0) return
  isProcessingQueue = true

  while (commandQueue.length > 0) {
    const data = commandQueue.shift()!
    try {
      switch (data.type) {
        case 'INIT':
          console.log('[[Worker Thread]] Processing INIT command')
          handleSyncInput(data.payload)
          break

        case 'SYNC_INPUT':
          handleSyncInput(data.payload)
          break

        case 'TICK':
          engine.update(1.0)
          sendSyncOutput()
          break
      }
    } catch (err) {
      console.error('[[Worker Thread]] Error processing message in FIFO queue:', err)
    }
  }

  isProcessingQueue = false
}

/**
 * Sync Input Reconciler
 * Parses compacted states, registers new entities, updates components, and prunes deleted entities to prevent leaks.
 */
function handleSyncInput(payload: SimInitPayload | SimSyncInputPayload) {
  const world = engine.getWorld()
  const { nodes, applications } = payload

  // 1. Gather all active entity IDs in the incoming payload
  const incomingIds = new Set<string>()
  nodes.forEach(node => incomingIds.add(node.id))
  applications.forEach(app => incomingIds.add(app.id))

  // 2. Fetch all current entity IDs registered in the ECS World
  const currentEntities = world.getEntitiesWith([])

  // 3. Reconcile & Prune Leaks: expunge entities missing in the incoming payload
  let prunedCount = 0
  currentEntities.forEach(id => {
    if (!incomingIds.has(id)) {
      world.removeEntity(id)
      prunedCount++
    }
  })

  if (prunedCount > 0) {
    console.log(`[[Worker Thread Reconciler]] Pruned ${prunedCount} deleted entities from simulation.`)
  }

  // 4. Update Node Components
  nodes.forEach(node => {
    // Only register entity if it is new to avoid console warnings
    if (!world.hasComponent('transform', node.id)) {
      world.registerEntity(node.id)
    }
    
    world.addComponent('transform', {
      entityId: node.id,
      siteId: node.siteId,
      parentRackId: node.parentRackId,
      slotIndex: node.slotIndex,
      type: node.type
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: node.id,
      temperature: node.temperature ?? 22.0,
      isThrottled: node.isThrottled ?? false,
      btuOutput: node.btuOutput,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: node.id,
      wattage: node.wattage,
      load: node.currentPowerKW || 0,
      isPowered: node.systemState !== 'off',
      efficiency: 0.9
    } as PowerComponent)

    world.addComponent('provisioning', {
      entityId: node.id,
      state: node.provisioningState,
      bootProgress: node.bootProgress
    } as ProvisioningComponent)
  })

  // 5. Update Application Components
  applications.forEach(app => {
    if (!world.hasComponent('application', app.id)) {
      world.registerEntity(app.id)
    }

    world.addComponent('application', {
      entityId: app.id,
      appId: app.appId,
      status: app.status,
      progress: app.progress
    } as ApplicationComponent)
    
    const nodePower = world.getComponent<PowerComponent>('power', app.nodeId)
    if (nodePower) {
       world.addComponent('power', { ...nodePower, entityId: app.id })
    }
  })
}

function sendSyncOutput() {
  const world = engine.getWorld()
  const telemetry = engine.getTelemetry()
  
  const output: SimSyncOutputPayload = {
    nodes: [],
    applications: []
  }

  // Collect results from components
  const thermalMap = world.getComponentMap<ThermalComponent>('thermal')
  const powerMap = world.getComponentMap<PowerComponent>('power')
  const provMap = world.getComponentMap<ProvisioningComponent>('provisioning')
  const appMap = world.getComponentMap<ApplicationComponent>('application')

  thermalMap.forEach((comp, id) => {
    const power = powerMap.get(id)
    const prov = provMap.get(id)
    if (power || prov) { // Only for hardware, not for apps-as-entities
      output.nodes.push({
        id,
        temperature: comp.temperature,
        isThrottled: comp.isThrottled,
        currentPowerKW: power?.load ?? 0,
        bootProgress: prov?.bootProgress ?? 0,
        systemState: prov && prov.bootProgress >= 100 ? 'running' : 'booting' // Simplified
      })
    }
  })

  appMap.forEach((comp, id) => {
    output.applications.push({
      id,
      status: comp.status,
      progress: comp.progress
    })
  })

  self.postMessage({ type: 'SYNC_OUTPUT', payload: output })
  self.postMessage({ type: 'TELEMETRY', payload: telemetry })
}
