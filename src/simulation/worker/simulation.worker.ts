import { SimulationEngine } from '../SimulationEngine'
import { ThermalSystem } from '../ecs/systems/ThermalSystem'
import { PacketSystem } from '../ecs/systems/PacketSystem'
import { ObservabilitySystem } from '../ecs/systems/ObservabilitySystem'
import { TelemetrySystem } from '../ecs/systems/TelemetrySystem'
import { AutomationSystem } from '../ecs/systems/AutomationSystem'
import type { SimMessage, SimInitPayload, SimSyncInputPayload, SimSyncOutputPayload } from './workerTypes'
import type { Connection } from '../../store/infraTypes'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
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

        case 'FACILITY_FEED': {
          const { feed, status } = data.payload
          import('../ecs/systems/PowerSystem').then(({ PowerSystem }) => {
            if (feed === 'A') PowerSystem.facilityFeeds.A = status
            if (feed === 'B') PowerSystem.facilityFeeds.B = status
            console.log(`[[Worker Thread]] Utility Feed ${feed} is now ${status ? 'ONLINE' : 'OFFLINE'}`)
          })
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
  const { nodes, applications, virtualMachines, contracts, connections, networkLoad, tickets, incidents } = payload

  // Track global network load deterministically inside the PacketSystem
  if (networkLoad !== undefined) {
    PacketSystem.networkLoad = networkLoad
  }

  // 1. Gather all active entity IDs in the incoming payload (including connection links)
  const incomingIds = new Set<string>()
  nodes.forEach(node => incomingIds.add(node.id))
  applications.forEach(app => incomingIds.add(app.id))
  if (virtualMachines) {
    virtualMachines.forEach(vm => incomingIds.add(vm.id))
  }
  if (contracts) {
    contracts.forEach(contract => incomingIds.add(contract.id))
  }
  if (connections) {
    connections.forEach(conn => incomingIds.add(conn.id))
  }
  if (tickets) {
    tickets.forEach(ticket => incomingIds.add(ticket.id))
  }
  if (incidents) {
    incidents.forEach(incident => incomingIds.add(incident.id))
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

  // 4. Update Node Components (using Granular Diffing to preserve Worker-driven simulation state)
  nodes.forEach(node => {
    // Only register entity if it is new to avoid console warnings
    if (!world.hasComponent('transform', node.id)) {
      world.registerEntity(node.id)
    }

    // 4.1 Update Transform Component
    if (!world.hasComponent('transform', node.id)) {
      world.addComponent('transform', {
        entityId: node.id,
        siteId: node.siteId,
        parentRackId: node.parentRackId,
        slotIndex: node.slotIndex,
        type: node.type,
        name: node.name,
        catalogKey: node.catalogKey,
        uHeight: node.uHeight,
        degradation: node.degradationPercent,
        healthStatus: node.healthStatus,
        isBlackholed: node.isBlackholed,
        rateLimitGbps: node.rateLimitGbps
      } as TransformComponent)
    } else {
      const transform = world.getComponent<TransformComponent>('transform', node.id)
      if (transform) {
        transform.siteId = node.siteId
        transform.parentRackId = node.parentRackId
        transform.slotIndex = node.slotIndex
        transform.type = node.type
        transform.name = node.name
        transform.catalogKey = node.catalogKey
        transform.uHeight = node.uHeight
        transform.degradation = node.degradationPercent
        transform.healthStatus = node.healthStatus
        transform.isBlackholed = node.isBlackholed
        transform.rateLimitGbps = node.rateLimitGbps
      }
    }

    // 4.2 Update Thermal Component
    if (!world.hasComponent('thermal', node.id)) {
      world.addComponent('thermal', {
        entityId: node.id,
        temperature: node.temperature ?? 22.0,
        isThrottled: node.isThrottled ?? false,
        fanSpeedPercent: node.fanSpeedPercent ?? 20.0,
        btuOutput: node.btuOutput,
        lastUpdate: Date.now(),
        humidity: node.humidity,
        containmentType: node.containmentType ?? 'none',
        isStandby: node.isStandby ?? false,
        accumulatedSimTime: node.accumulatedSimTime ?? 0.0
      } as ThermalComponent)
    } else {
      const thermal = world.getComponent<ThermalComponent>('thermal', node.id)
      if (thermal) {
        if (node.containmentType !== undefined) thermal.containmentType = node.containmentType
        if (node.isStandby !== undefined) thermal.isStandby = node.isStandby
        // Do NOT overwrite dynamic simulated fields (temperature, isThrottled, fanSpeedPercent, btuOutput, lastUpdate, accumulatedSimTime)
      }
    }

    // 4.3 Update Power Component
    if (!world.hasComponent('power', node.id)) {
      const catalogSpec = node.catalogKey ? HARDWARE_CATALOG[node.catalogKey as keyof typeof HARDWARE_CATALOG] : null
      const baseWattage = catalogSpec ? catalogSpec.wattage : (node.wattage || 300)
      
      world.addComponent('power', {
        entityId: node.id,
        wattage: 0,
        load: 0,
        apparentPowerVA: 0,
        phaseLoadsWatts: [0, 0, 0],
        phaseLoadsVA: [0, 0, 0],
        isPowered: node.systemState !== 'off' && !node.breakerTripped,
        efficiency: 0.85,
        breakerTripped: node.breakerTripped ?? false,
        phase: node.phase,
        dualPSU: node.dualPSU,
        overloadSeconds: node.overloadSeconds ?? 0,
        feedSource: node.feedSource ?? 'both',
        baseWattage: baseWattage,
        upsMaxBatterySeconds: node.uHeight === 0 ? 10.0 : 30.0,
        upsBatterySeconds: node.uHeight === 0 ? 10.0 : 30.0,
        systemState: node.systemState as 'off' | 'booting' | 'running'
      } as PowerComponent)
    } else {
      const power = world.getComponent<PowerComponent>('power', node.id)
      if (power) {
        if (node.systemState !== undefined) {
          power.systemState = node.systemState as 'off' | 'booting' | 'running'
        }
        const isPowered = node.systemState !== 'off' && !node.breakerTripped
        if (power.isPowered !== isPowered) power.isPowered = isPowered
        if (node.breakerTripped !== undefined && power.breakerTripped !== node.breakerTripped) {
          power.breakerTripped = node.breakerTripped
          if (!node.breakerTripped) {
            power.overloadSeconds = 0
          }
        }
        if (node.overloadSeconds !== undefined && node.overloadSeconds === 0) {
          power.overloadSeconds = 0
        }
        if (node.feedSource !== undefined && power.feedSource !== node.feedSource) {
          power.feedSource = node.feedSource
        }
        if (node.phase !== undefined && power.phase !== node.phase) {
          power.phase = node.phase
        }
        if (node.dualPSU !== undefined && power.dualPSU !== node.dualPSU) {
          power.dualPSU = node.dualPSU
        }
        // Do NOT overwrite worker-simulated fields (baseWattage, wattage, load, overloadSeconds, upsBatterySeconds, apparentPowerVA)
      }
    }

    // 4.4 Update Provisioning Component
    if (!world.hasComponent('provisioning', node.id)) {
      world.addComponent('provisioning', {
        entityId: node.id,
        state: node.provisioningState,
        bootProgress: node.bootProgress
      } as ProvisioningComponent)
    } else {
      const provisioning = world.getComponent<ProvisioningComponent>('provisioning', node.id)
      if (provisioning) {
        provisioning.state = node.provisioningState
        provisioning.bootProgress = node.bootProgress
      }
    }

    // 4.5 Initialize Telemetry Component
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

    // 4.6 Update Storage Component
    if (node.type === 'storage' || node.type === 'compute' || (node.totalStorageTB && node.totalStorageTB > 0)) {
      if (!world.hasComponent('storage', node.id)) {
        world.addComponent('storage', {
          entityId: node.id,
          totalStorageTB: node.totalStorageTB ?? 0,
          usedStorageTB: node.usedStorageTB ?? 0,
          ioPSLimit: node.ioPSLimit ?? 5000,
          ioPSUsed: node.ioPSUsed ?? 0,
          raidLevel: node.raidLevel ?? 'RAID5',
          storageStatus: node.storageStatus ?? 'healthy',
          rebuildProgress: node.rebuildProgress ?? 0,
          driveDegradation: node.driveDegradation ?? 0,
          tier: node.tier ?? 'hdd',
          failedDrives: node.failedDrives ?? 0,
          replicationSourceId: node.replicationSourceId,
          replicationProgress: node.replicationProgress ?? 0,
          deduplicationEnabled: node.deduplicationEnabled ?? false,
          compressionEnabled: node.compressionEnabled ?? false,
          deduplicationRatio: node.deduplicationRatio ?? 2.4,
          compressionRatio: node.compressionRatio ?? 1.5,
          physicalUsedStorageTB: node.physicalUsedStorageTB ?? node.usedStorageTB ?? 0,
          writeAmplificationFactor: node.writeAmplificationFactor ?? 1.0
        } as StorageComponent)
      } else {
        const storage = world.getComponent<StorageComponent>('storage', node.id)
        if (storage) {
          storage.totalStorageTB = node.totalStorageTB ?? storage.totalStorageTB
          storage.usedStorageTB = node.usedStorageTB ?? storage.usedStorageTB
          storage.ioPSLimit = node.ioPSLimit ?? storage.ioPSLimit
          storage.ioPSUsed = node.ioPSUsed ?? storage.ioPSUsed
          storage.raidLevel = node.raidLevel ?? storage.raidLevel
          storage.storageStatus = node.storageStatus ?? storage.storageStatus
          storage.rebuildProgress = node.rebuildProgress ?? storage.rebuildProgress
          storage.driveDegradation = node.driveDegradation ?? storage.driveDegradation
          storage.tier = node.tier ?? storage.tier
          storage.failedDrives = node.failedDrives ?? storage.failedDrives
          storage.replicationSourceId = node.replicationSourceId ?? storage.replicationSourceId
          storage.replicationProgress = node.replicationProgress ?? storage.replicationProgress
          storage.deduplicationEnabled = node.deduplicationEnabled ?? storage.deduplicationEnabled
          storage.compressionEnabled = node.compressionEnabled ?? storage.compressionEnabled
          storage.deduplicationRatio = node.deduplicationRatio ?? storage.deduplicationRatio
          storage.compressionRatio = node.compressionRatio ?? storage.compressionRatio
          storage.physicalUsedStorageTB = node.physicalUsedStorageTB ?? storage.physicalUsedStorageTB
          storage.writeAmplificationFactor = node.writeAmplificationFactor ?? storage.writeAmplificationFactor
        }
      }
    }


    // 4.6.5 Update Backup Component
    if (node.type === 'compute' || node.type === 'storage' || node.type === 'backup') {
      if (!world.hasComponent('backup', node.id)) {
        world.addComponent('backup', {
          entityId: node.id,
          backupStatus: node.backupStatus ?? 'unprotected',
          lastBackupTime: node.lastBackupTime ?? 0,
          corruptionState: node.corruptionState ?? 'clean'
        } as import('../ecs/types').BackupComponent)
      } else {
        const backup = world.getComponent<import('../ecs/types').BackupComponent>('backup', node.id)
        if (backup) {
          if (node.backupStatus !== undefined) backup.backupStatus = node.backupStatus
          if (node.lastBackupTime !== undefined) backup.lastBackupTime = node.lastBackupTime
          if (node.corruptionState !== undefined) backup.corruptionState = node.corruptionState
        }
      }
    }

    // 4.6.6 Update Security Component
    if (!world.hasComponent('security', node.id)) {
      world.addComponent('security', {
        entityId: node.id,
        infectionState: node.infectionState ?? 'clean',
        infectionProgress: 0,
        encryptionRate: 0.05,
        isIsolated: node.isIsolated ?? false,
        microsegmentationEnabled: node.microsegmentationEnabled ?? false,
        isFirmwareOutdated: node.firmwareVersion !== payload.globalTargetFirmware
      } as import('../ecs/types').SecurityComponent)
    } else {
      const security = world.getComponent<import('../ecs/types').SecurityComponent>('security', node.id)
      if (security) {
        if (node.infectionState !== undefined) security.infectionState = node.infectionState
        if (node.isIsolated !== undefined) security.isIsolated = node.isIsolated
        if (node.microsegmentationEnabled !== undefined) security.microsegmentationEnabled = node.microsegmentationEnabled
        if (payload.globalTargetFirmware) security.isFirmwareOutdated = node.firmwareVersion !== payload.globalTargetFirmware
      }
    }

    // 4.7 Update Rack Component
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

      if (!world.hasComponent('rack', node.id)) {
        world.addComponent('rack', {
          entityId: node.id,
          maxPowerKW: hasPDU ? 15.0 : (node.maxPowerKW ?? 5.0),
          currentPowerKW: node.currentPowerKW ?? 0,
          status: (node.status as 'online' | 'power_overload') ?? 'online',
          hasHighDensityPDU: hasPDU,
          slotOccupancy: occupancy,
          containmentType: node.containmentType,
          blankingPanels: node.blankingPanels,
          pduFeeds: node.pduFeeds
        } as RackComponent)
      } else {
        const rack = world.getComponent<RackComponent>('rack', node.id)
        if (rack) {
          rack.maxPowerKW = hasPDU ? 15.0 : (node.maxPowerKW ?? 5.0)
          rack.hasHighDensityPDU = hasPDU
          rack.slotOccupancy = occupancy
          rack.containmentType = node.containmentType
          if (node.blankingPanels) rack.blankingPanels = node.blankingPanels
          if (node.pduFeeds) rack.pduFeeds = node.pduFeeds
          if (node.status !== undefined && node.status !== rack.status) {
            rack.status = node.status as 'online' | 'power_overload'
          }
          // status and currentPowerKW are calculated inside worker systems, so do NOT overwrite them!
        }
      }
    }

    // 4.8 Update Load Balancer & Edge Cache Components
    if (node.type === 'load_balancer') {
      if (!world.hasComponent('loadBalancer', node.id)) {
        world.addComponent('loadBalancer', {
          entityId: node.id,
          targetGroupIds: [],
          activeConnections: 0,
          totalThroughputGbps: 0,
          healthCheckInterval: 5000,
          lastHealthCheck: 0,
          routingMethod: 'least_connections'
        } as import('../ecs/types').LoadBalancerComponent)
      }
    }

    if (node.type === 'edge_cache') {
      if (!world.hasComponent('edgeCache', node.id)) {
        world.addComponent('edgeCache', {
          entityId: node.id,
          cacheHitRatio: 0,
          bandwidthSavedGbps: 0,
          totalRequests: 0
        } as import('../ecs/types').EdgeCacheComponent)
      }
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
      progress: app.progress,
      loadBalancerId: app.loadBalancerId,
      targetGroupIds: app.targetGroupIds
    } as import('../ecs/types').ApplicationComponent)
    
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
          type: conn.type,
          packetLoss: conn.packetLoss ?? 0.0,
          controlQueueDelayMs: conn.controlQueueDelayMs,
          bulkQueueDelayMs: conn.bulkQueueDelayMs,
          packetsDropped: conn.packetsDropped,
          isBlackholed: conn.isBlackholed,
          rateLimitGbps: conn.rateLimitGbps
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
          if (conn.packetLoss !== undefined && existing.packetLoss !== conn.packetLoss) {
            existing.packetLoss = conn.packetLoss
          }
          if (conn.controlQueueDelayMs !== undefined && existing.controlQueueDelayMs !== conn.controlQueueDelayMs) {
            existing.controlQueueDelayMs = conn.controlQueueDelayMs
          }
          if (conn.bulkQueueDelayMs !== undefined && existing.bulkQueueDelayMs !== conn.bulkQueueDelayMs) {
            existing.bulkQueueDelayMs = conn.bulkQueueDelayMs
          }
          if (conn.packetsDropped !== undefined && existing.packetsDropped !== conn.packetsDropped) {
            existing.packetsDropped = conn.packetsDropped
          }
          if (conn.isBlackholed !== undefined && existing.isBlackholed !== conn.isBlackholed) {
            existing.isBlackholed = conn.isBlackholed
          }
          if (conn.rateLimitGbps !== undefined && existing.rateLimitGbps !== conn.rateLimitGbps) {
            existing.rateLimitGbps = conn.rateLimitGbps
          }
        }
      }
    })
  }
  // 5.2 Update Contract Components
  if (contracts) {
    contracts.forEach(contract => {
      if (!world.hasComponent('contract', contract.id)) {
        world.registerEntity(contract.id)
        
        world.addComponent('contract', {
          entityId: contract.id,
          blueprintId: contract.blueprintId,
          totalTicks: contract.totalTicks,
          uptimeTicks: contract.uptimeTicks,
          accumulatedPenalty: contract.accumulatedPenalty,
          currentStatus: contract.currentStatus
        } as import('../ecs/types').ContractComponent)
      } else {
        const existing = world.getComponent<import('../ecs/types').ContractComponent>('contract', contract.id)
        if (existing) {
          existing.blueprintId = contract.blueprintId
          existing.totalTicks = contract.totalTicks
          existing.uptimeTicks = contract.uptimeTicks
          existing.accumulatedPenalty = contract.accumulatedPenalty
          existing.currentStatus = contract.currentStatus
        }
      }
    })
  }
  // 5.3 Update Virtual Machines
  if (virtualMachines) {
    virtualMachines.forEach(vm => {
      if (!world.hasComponent('vm', vm.id)) {
        world.registerEntity(vm.id)
        
        world.addComponent('vm', {
          entityId: vm.id,
          nodeId: vm.nodeId,
          status: vm.status,
          cpuCores: vm.cpuCores,
          memoryGB: vm.memoryGB,
          storageGB: vm.storageGB,
          migratingToNodeId: vm.migratingToNodeId,
          migrationProgress: vm.migrationProgress
        } as import('../ecs/types').VmComponent)
      } else {
        const existing = world.getComponent<import('../ecs/types').VmComponent>('vm', vm.id)
        if (existing) {
          existing.nodeId = vm.nodeId
          existing.status = vm.status
          existing.migratingToNodeId = vm.migratingToNodeId
          // Migration progress is simulation-driven, don't overwrite if it's currently migrating unless it's null
          if (vm.migrationProgress === undefined) {
            existing.migrationProgress = undefined
          }
        }
      }
    })
  }

  // 5.4 Update Tickets
  if (tickets) {
    tickets.forEach(ticket => {
      if (!world.hasComponent('TicketComponent', ticket.id)) {
        world.registerEntity(ticket.id)
        world.addComponent('TicketComponent', {
          entityId: ticket.id,
          ticketId: ticket.id,
          targetNodeId: ticket.nodeId,
          type: ticket.type,
          status: ticket.status,
          totalSeconds: ticket.totalSeconds,
          elapsedSeconds: ticket.elapsedSeconds
        } as import('../ecs/types').TicketComponent)
      } else {
        const existing = world.getComponent<import('../ecs/types').TicketComponent>('TicketComponent', ticket.id)
        if (existing) {
          existing.status = ticket.status
          // Do not overwrite elapsedSeconds as it is managed by the Simulation Engine deterministically
        }
      }
    })
  }

  // 5.5 Update Incidents
  if (incidents) {
    incidents.forEach(incident => {
      if (!world.hasComponent('IncidentComponent', incident.id)) {
        world.registerEntity(incident.id)
        world.addComponent('IncidentComponent', {
          entityId: incident.id,
          incidentId: incident.id,
          type: incident.type,
          severity: incident.severity,
          affectedNodes: incident.affectedNodes,
          elapsedSeconds: incident.elapsedSeconds,
          isResolved: incident.isResolved,
          rtoTargetSeconds: incident.rtoTargetSeconds,
          siteId: incident.siteId,
          startTimestamp: incident.startTimestamp
        } as import('../ecs/types').IncidentComponent)
      } else {
        const existing = world.getComponent<import('../ecs/types').IncidentComponent>('IncidentComponent', incident.id)
        if (existing) {
          // Do not overwrite elapsedSeconds or isResolved since they are engine-driven
        }
      }
    })
  }
  // 6. Automation Policies Sync
  if (payload.automationPolicies) {
    const autoSys = engine.getSystemManager().getSystem(AutomationSystem)
    if (autoSys) {
      autoSys.setPolicies(payload.automationPolicies)
    }
  }
}

function sendSyncOutput() {
  const world = engine.getWorld()
  const telemetry = engine.getTelemetry()
  const obs = engine.getSystemManager().getSystem(ObservabilitySystem)
  const alerts = obs ? obs.flushAlerts() : []
  
  let firedAutomationPolicies: { id: string, firedAt: number }[] = []
  const autoSys = engine.getSystemManager().getSystem(AutomationSystem)
  if (autoSys) {
    firedAutomationPolicies = autoSys.flushFiredPolicies()
  }

  const output: SimSyncOutputPayload = {
    nodes: [],
    applications: [],
    contracts: [],
    virtualMachines: [],
    connections: [],
    alerts,
    tickets: [],
    incidents: [],
    firedAutomationPolicies
  }

  // Collect results from components
  const transformMap = world.getComponentMap<TransformComponent>('transform')
  const thermalMap = world.getComponentMap<ThermalComponent>('thermal')
  const powerMap = world.getComponentMap<PowerComponent>('power')
  const provMap = world.getComponentMap<ProvisioningComponent>('provisioning')
  const storageMap = world.getComponentMap<StorageComponent>('storage')
  const appMap = world.getComponentMap<ApplicationComponent>('application')
  const contractMap = world.getComponentMap<import('../ecs/types').ContractComponent>('contract')
  const vmMap = world.getComponentMap<import('../ecs/types').VmComponent>('vm')
  const connectionMap = world.getComponentMap<ConnectionComponent>('connection')
  const backupMap = world.getComponentMap<import('../ecs/types').BackupComponent>('backup')
  const securityMap = world.getComponentMap<import('../ecs/types').SecurityComponent>('security')
  const ticketMap = world.getComponentMap<import('../ecs/types').TicketComponent>('TicketComponent')
  const incidentMap = world.getComponentMap<import('../ecs/types').IncidentComponent>('IncidentComponent')

  thermalMap.forEach((comp, id) => {
    const power = powerMap.get(id)
    const prov = provMap.get(id)
    const storage = storageMap.get(id)
    const backup = backupMap.get(id)
    const security = securityMap.get(id)
    const transform = transformMap.get(id)
    if (power || prov) { // Only for hardware, not for apps-as-entities
      output.nodes.push({
        id,
        temperature: comp.temperature,
        isThrottled: comp.isThrottled,
        currentPowerKW: power?.load ?? 0,
        bootProgress: prov?.bootProgress ?? 0,
        systemState: power ? (power.isPowered ? power.systemState : 'off') : undefined,
        breakerTripped: power?.breakerTripped,
        overloadSeconds: power?.overloadSeconds,
        feedSource: power?.feedSource,
        wattage: power?.wattage,
        totalStorageTB: storage?.totalStorageTB,
        usedStorageTB: storage?.usedStorageTB,
        raidLevel: storage?.raidLevel,
        storageStatus: storage?.storageStatus,
        rebuildProgress: storage?.rebuildProgress,
        tier: storage?.tier,
        failedDrives: storage?.failedDrives,
        replicationSourceId: storage?.replicationSourceId,
        replicationProgress: storage?.replicationProgress,
        ioPSLimit: storage?.ioPSLimit,
        ioPSUsed: storage?.ioPSUsed,
        driveDegradation: storage?.driveDegradation,
        deduplicationEnabled: storage?.deduplicationEnabled,
        compressionEnabled: storage?.compressionEnabled,
        deduplicationRatio: storage?.deduplicationRatio,
        compressionRatio: storage?.compressionRatio,
        physicalUsedStorageTB: storage?.physicalUsedStorageTB,
        writeAmplificationFactor: storage?.writeAmplificationFactor,
        fanSpeedPercent: comp.fanSpeedPercent,
        humidity: comp.humidity,
        containmentType: comp.containmentType,
        isStandby: comp.isStandby,
        accumulatedSimTime: comp.accumulatedSimTime,
        infectionState: security?.infectionState,
        infectionProgress: security?.infectionProgress,
        isIsolated: security?.isIsolated,
        isBlackholed: transform?.isBlackholed,
        backupStatus: backup?.backupStatus,
        lastBackupTime: backup?.lastBackupTime,
        corruptionState: backup?.corruptionState
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

  contractMap.forEach((comp, id) => {
    output.contracts.push({
      id,
      totalTicks: comp.totalTicks,
      uptimeTicks: comp.uptimeTicks,
      accumulatedPenalty: comp.accumulatedPenalty,
      currentStatus: comp.currentStatus
    })
  })

  vmMap.forEach((comp, id) => {
    output.virtualMachines!.push({
      id,
      nodeId: comp.nodeId,
      status: comp.status,
      migratingToNodeId: comp.migratingToNodeId,
      migrationProgress: comp.migrationProgress
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
      type: comp.type as unknown as Connection['type'],
      packetLoss: comp.packetLoss,
      controlQueueDelayMs: comp.controlQueueDelayMs,
      bulkQueueDelayMs: comp.bulkQueueDelayMs,
      packetsDropped: comp.packetsDropped,
      isBlackholed: comp.isBlackholed,
      rateLimitGbps: comp.rateLimitGbps
    })
  })

  ticketMap.forEach((comp, id) => {
    output.tickets!.push({
      id,
      nodeId: comp.targetNodeId,
      nodeName: '',
      cost: 0,
      type: comp.type,
      status: comp.status,
      totalSeconds: comp.totalSeconds,
      elapsedSeconds: comp.elapsedSeconds,
      progress: Math.min(100, Math.round((comp.elapsedSeconds / comp.totalSeconds) * 100)),
      severity: ((comp as unknown as { severity?: import('../../store/infraTypes').TicketSeverity }).severity || 'P2') as import('../../store/infraTypes').TicketSeverity,
      slaTargetSeconds: (comp as unknown as { slaTargetSeconds?: number }).slaTargetSeconds || 120
    })
  })

  incidentMap.forEach((comp, id) => {
    output.incidents!.push({
      id,
      siteId: comp.siteId || 'global',
      startTimestamp: comp.startTimestamp || 0,
      type: comp.type,
      severity: comp.severity,
      affectedNodes: comp.affectedNodes,
      elapsedSeconds: comp.elapsedSeconds,
      isResolved: comp.isResolved,
      rtoTargetSeconds: comp.rtoTargetSeconds
    })
  })

  // Compile site localized ambient temperatures from the ThermalSystem
  const temps: Record<string, number> = {}
  ThermalSystem.siteAmbientTemps.forEach((temp, siteId) => {
    temps[siteId] = temp
  })
  output.siteAmbientTemps = temps

  const hums: Record<string, number> = {}
  ThermalSystem.siteAmbientHumidity.forEach((hum, siteId) => {
    hums[siteId] = hum
  })
  output.siteAmbientHumidity = hums

  // Compile background Rack States
  const rackMap = world.getComponentMap<RackComponent>('rack')
  const rackOutputs: Array<{
    id: string
    status: 'online' | 'power_overload'
    maxPowerKW: number
    currentPowerKW: number
    totalWeightKG?: number
    maxWeightKG?: number
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
      currentPowerKW: rack.currentPowerKW,
      totalWeightKG: rack.totalWeightKG,
      maxWeightKG: rack.maxWeightKG
    })
  })
  output.racks = rackOutputs
  output.overloadedRackCount = overloadedCount

  // Compile site-wide metrics history
  const history: Record<string, { power: number[]; temp: number[]; humidity: number[] }> = {}
  const telemetrySys = engine.getSystemManager().getSystem(TelemetrySystem)
  if (telemetrySys) {
    telemetrySys.sitePowerHistory.forEach((_, siteId) => {
      history[siteId] = {
        power: telemetrySys.sitePowerHistory.get(siteId)?.toArray() ?? [],
        temp: telemetrySys.siteTempHistory.get(siteId)?.toArray() ?? [],
        humidity: telemetrySys.siteHumidityHistory.get(siteId)?.toArray() ?? []
      }
    })
  }
  output.siteMetricsHistory = history

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
