import { SimulationEngine } from '../SimulationEngine'
import { ThermalSystem } from '../ecs/systems/ThermalSystem'
import { PacketSystem } from '../ecs/systems/PacketSystem'
import { ObservabilitySystem } from '../ecs/systems/ObservabilitySystem'
import type { SimMessage, SimInitPayload, SimSyncInputPayload, SimSyncOutputPayload } from './workerTypes'
import type { Connection } from '../../store/infraTypes'
import type { 
  ThermalComponent, 
  PowerComponent, 
  TransformComponent, 
  ProvisioningComponent, 
  ApplicationComponent,
  StorageComponent,
  ConnectionComponent,
  TelemetryComponent,
  RackComponent
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

  let processedMsg: SimMessage = msg
  if (msg.payload instanceof ArrayBuffer) {
    try {
      const decoder = new TextDecoder()
      const jsonStr = decoder.decode(new Uint8Array(msg.payload))
      processedMsg = { ...msg, payload: JSON.parse(jsonStr) } as unknown as SimMessage
    } catch (err) {
      console.error('[[Worker Thread]] Failed to decode incoming transferable payload:', err)
    }
  }

  commandQueue.push(processedMsg)
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

        case 'TICK': {
          const dt = data.payload?.dt ?? 1.0
          engine.update(dt)
          sendSyncOutput()
          break
        }
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
  const { nodes, applications, connections, networkLoad } = payload

  // Track global network load deterministically inside the PacketSystem
  if (networkLoad !== undefined) {
    PacketSystem.networkLoad = networkLoad
  }

  // 1. Gather all active entity IDs in the incoming payload (including connection links)
  const incomingIds = new Set<string>()
  nodes.forEach(node => incomingIds.add(node.id))
  applications.forEach(app => incomingIds.add(app.id))
  if (connections) {
    connections.forEach(conn => incomingIds.add(conn.id))
  }

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
      type: node.type,
      name: node.name,
      catalogKey: node.catalogKey,
      // Map incident metrics for networking calculations
      degradation: node.degradationPercent,
      healthStatus: node.healthStatus,
      isInfected: node.isInfected
    } as TransformComponent)

    world.addComponent('thermal', {
      entityId: node.id,
      temperature: node.temperature ?? 22.0,
      isThrottled: node.isThrottled ?? false,
      fanSpeedPercent: node.fanSpeedPercent ?? 20.0,
      btuOutput: node.btuOutput,
      lastUpdate: Date.now()
    } as ThermalComponent)

    world.addComponent('power', {
      entityId: node.id,
      wattage: node.wattage,
      load: node.currentPowerKW || 0,
      isPowered: node.systemState !== 'off' && !node.breakerTripped,
      efficiency: 0.9,
      breakerTripped: node.breakerTripped ?? false,
      overloadSeconds: node.overloadSeconds ?? 0,
      feedSource: node.feedSource ?? 'both',
      baseWattage: node.wattage
    } as PowerComponent)

    world.addComponent('provisioning', {
      entityId: node.id,
      state: node.provisioningState,
      bootProgress: node.bootProgress
    } as ProvisioningComponent)

    if (!world.hasComponent('telemetry', node.id)) {
      world.addComponent('telemetry', {
        entityId: node.id,
        uptimeTicks: 0,
        totalTicks: 0,
        powerSpikesCount: 0,
        thermalThrottlingTicks: 0,
        networkCongestionTicks: 0,
        storageIopsThrottlingTicks: 0,
        auditViolationsCount: 0
      } as TelemetryComponent)
    }

    if (node.type === 'storage' || node.type === 'compute' || (node.totalStorageTB && node.totalStorageTB > 0)) {
      world.addComponent('storage', {
        entityId: node.id,
        totalStorageTB: node.totalStorageTB ?? 0,
        usedStorageTB: node.usedStorageTB ?? 0,
        ioPSLimit: node.ioPSLimit ?? 5000,
        ioPSUsed: node.ioPSUsed ?? 0,
        raidLevel: node.raidLevel ?? 'RAID5',
        storageStatus: node.storageStatus ?? 'healthy',
        rebuildProgress: node.rebuildProgress ?? 0,
        driveDegradation: node.driveDegradation ?? 0
      } as StorageComponent)
    }

    if (node.type === 'rack') {
      const hasPDU = nodes.some(n => n.parentRackId === node.id && n.catalogKey === 'HIGH_DENSITY_PDU_1U')
      const uHeight = node.uHeight || 42
      const occupancy = new Array(uHeight + 1).fill(false)
      nodes.forEach(n => {
        if (n.parentRackId === node.id && n.slotIndex != null && n.type !== 'rack') {
          const childH = n.uHeight || 1
          for (let u = n.slotIndex; u < n.slotIndex + childH; u++) {
            if (u < occupancy.length) {
              occupancy[u] = true
            }
          }
        }
      })

      world.addComponent('rack', {
        entityId: node.id,
        maxPowerKW: hasPDU ? 15.0 : (node.maxPowerKW ?? 5.0),
        currentPowerKW: node.currentPowerKW ?? 0,
        status: (node.status as 'online' | 'power_overload') ?? 'online',
        hasHighDensityPDU: hasPDU,
        slotOccupancy: occupancy
      } as RackComponent)
    }
  })

  // 5. Update Application Components
  applications.forEach(app => {
    if (!world.hasComponent('application', app.id)) {
      world.registerEntity(app.id)
    }

    world.addComponent('application', {
      entityId: app.id,
      appId: app.appId,
      nodeId: app.nodeId,
      status: app.status,
      progress: app.progress
    } as ApplicationComponent)
    
    const nodePower = world.getComponent<PowerComponent>('power', app.nodeId)
    if (nodePower) {
       world.addComponent('power', { ...nodePower, entityId: app.id })
    }
  })

  // 5.1 Update Connection Components using Diff-based updates (Persistent Pool)
  if (connections) {
    connections.forEach(conn => {
      if (!world.hasComponent('connection', conn.id)) {
        world.registerEntity(conn.id)
        
        world.addComponent('connection', {
          entityId: conn.id,
          startNodeId: conn.startNodeId,
          startPortId: conn.startPortId,
          endNodeId: conn.endNodeId,
          endPortId: conn.endPortId,
          bandwidthGbps: conn.bandwidthGbps,
          throughputGbps: conn.throughputGbps ?? 0,
          latencyMs: conn.latencyMs ?? 1,
          isBlockedByCompliance: conn.isBlockedByCompliance ?? false,
          status: conn.status ?? 'active',
          syncProgress: conn.syncProgress ?? 0,
          type: conn.type
        } as ConnectionComponent)
      } else {
        // Granular updates to preserve component identity & stable references
        const existing = world.getComponent<ConnectionComponent>('connection', conn.id)
        if (existing) {
          if (existing.startNodeId !== conn.startNodeId) existing.startNodeId = conn.startNodeId
          if (existing.startPortId !== conn.startPortId) existing.startPortId = conn.startPortId
          if (existing.endNodeId !== conn.endNodeId) existing.endNodeId = conn.endNodeId
          if (existing.endPortId !== conn.endPortId) existing.endPortId = conn.endPortId
          if (existing.bandwidthGbps !== conn.bandwidthGbps) existing.bandwidthGbps = conn.bandwidthGbps
          if (existing.type !== conn.type) existing.type = conn.type
          
          if (conn.throughputGbps !== undefined && existing.throughputGbps !== conn.throughputGbps) {
            existing.throughputGbps = conn.throughputGbps
          }
          if (conn.latencyMs !== undefined && existing.latencyMs !== conn.latencyMs) {
            existing.latencyMs = conn.latencyMs
          }
          if (conn.isBlockedByCompliance !== undefined && existing.isBlockedByCompliance !== conn.isBlockedByCompliance) {
            existing.isBlockedByCompliance = conn.isBlockedByCompliance
          }
          if (conn.status !== undefined && existing.status !== conn.status) {
            existing.status = conn.status
          }
          if (conn.syncProgress !== undefined && existing.syncProgress !== conn.syncProgress) {
            existing.syncProgress = conn.syncProgress
          }
        }
      }
    })
  }
}

function sendSyncOutput() {
  const world = engine.getWorld()
  const telemetry = engine.getTelemetry()
  
  const output: SimSyncOutputPayload = {
    nodes: [],
    applications: [],
    connections: [],
    alerts: ObservabilitySystem.flushAlerts()
  }

  // Collect results from components
  const thermalMap = world.getComponentMap<ThermalComponent>('thermal')
  const powerMap = world.getComponentMap<PowerComponent>('power')
  const provMap = world.getComponentMap<ProvisioningComponent>('provisioning')
  const storageMap = world.getComponentMap<StorageComponent>('storage')
  const appMap = world.getComponentMap<ApplicationComponent>('application')
  const connectionMap = world.getComponentMap<ConnectionComponent>('connection')

  thermalMap.forEach((comp, id) => {
    const power = powerMap.get(id)
    const prov = provMap.get(id)
    const storage = storageMap.get(id)
    if (power || prov) { // Only for hardware, not for apps-as-entities
      output.nodes.push({
        id,
        temperature: comp.temperature,
        isThrottled: comp.isThrottled,
        currentPowerKW: power?.load ?? 0,
        bootProgress: prov?.bootProgress ?? 0,
        systemState: (power && !power.isPowered) ? 'off' : undefined,
        breakerTripped: power?.breakerTripped,
        overloadSeconds: power?.overloadSeconds,
        feedSource: power?.feedSource,
        wattage: power?.wattage,
        totalStorageTB: storage?.totalStorageTB,
        usedStorageTB: storage?.usedStorageTB,
        raidLevel: storage?.raidLevel,
        storageStatus: storage?.storageStatus,
        rebuildProgress: storage?.rebuildProgress,
        ioPSLimit: storage?.ioPSLimit,
        ioPSUsed: storage?.ioPSUsed,
        driveDegradation: storage?.driveDegradation,
        fanSpeedPercent: comp.fanSpeedPercent
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

  connectionMap.forEach((comp, id) => {
    output.connections.push({
      id,
      startNodeId: comp.startNodeId,
      startPortId: comp.startPortId,
      endNodeId: comp.endNodeId,
      endPortId: comp.endPortId,
      bandwidthGbps: comp.bandwidthGbps,
      throughputGbps: comp.throughputGbps,
      latencyMs: comp.latencyMs,
      isBlockedByCompliance: comp.isBlockedByCompliance,
      status: comp.status,
      syncProgress: comp.syncProgress,
      type: comp.type as unknown as Connection['type']
    })
  })

  // Compile site localized ambient temperatures from the ThermalSystem
  const temps: Record<string, number> = {}
  ThermalSystem.siteAmbientTemps.forEach((temp, siteId) => {
    temps[siteId] = temp
  })
  output.siteAmbientTemps = temps

  // Compile background Rack States
  const rackMap = world.getComponentMap<RackComponent>('rack')
  const rackOutputs: Array<{
    id: string
    status: 'online' | 'power_overload'
    maxPowerKW: number
    currentPowerKW: number
  }> = []
  let overloadedCount = 0

  rackMap.forEach((rack, id) => {
    if (rack.status === 'power_overload') {
      overloadedCount++
    }
    rackOutputs.push({
      id,
      status: rack.status,
      maxPowerKW: rack.maxPowerKW,
      currentPowerKW: rack.currentPowerKW
    })
  })
  output.racks = rackOutputs
  output.overloadedRackCount = overloadedCount

  postMessageTransferable({ type: 'SYNC_OUTPUT', payload: output })
  postMessageTransferable({ type: 'TELEMETRY', payload: telemetry })
}

function postMessageTransferable(msg: { type: string; payload: unknown }) {
  try {
    const jsonStr = JSON.stringify(msg.payload)
    const encoder = new TextEncoder()
    const buffer = encoder.encode(jsonStr).buffer
    ;(self as unknown as Worker).postMessage({ type: msg.type, payload: buffer }, [buffer])
  } catch {
    self.postMessage(msg)
  }
}
