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

/**
 * Simulation Worker
 * Runs the ECS engine in a background thread.
 */
self.onmessage = (event: MessageEvent<SimMessage>) => {
  const { type, payload } = event.data

  switch (type) {
    case 'INIT':
      console.log('[[Worker Thread]] Received INIT command')
      handleSyncInput(payload as SimInitPayload)
      break

    case 'SYNC_INPUT':
      // console.log('[[Worker Thread]] Received SYNC_INPUT')
      handleSyncInput(payload as SimSyncInputPayload)
      break

    case 'TICK':
      engine.update(1.0)
      sendSyncOutput()
      break

    case 'PING':
      self.postMessage({ type: 'PONG' })
      break
  }
}

self.onerror = (e) => {
  console.error('[[Worker Thread]] Critical Error:', e)
}

function handleSyncInput(payload: SimSyncInputPayload) {
  const world = engine.getWorld()
  const { nodes, applications } = payload

  nodes.forEach(node => {
    world.registerEntity(node.id)
    
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

  applications.forEach(app => {
    world.registerEntity(app.id)
    world.addComponent('application', {
      entityId: app.id,
      appId: app.appId,
      status: app.status as any,
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
