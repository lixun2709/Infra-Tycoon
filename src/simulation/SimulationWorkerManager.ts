/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SimMessage, SimSyncOutputPayload, SimTelemetryPayload, SimInitPayload, SimSyncInputPayload } from './worker/workerTypes'
import type { InfraNode, ApplicationDeployment, Connection, ActiveContract, VirtualMachine, PodData, TechnicianTicket, Incident, AutomationPolicy } from '../store/infraTypes'
import { performanceMonitor } from './PerformanceMonitor'

/**
 * SimulationWorkerManager
 * Handles communication with the background simulation worker with resilience.
 */
export class SimulationWorkerManager {
  private worker: Worker | null = null
  private onOutputCallback: ((payload: SimSyncOutputPayload) => void) | null = null
  private onTelemetryCallback: ((payload: SimTelemetryPayload) => void) | null = null
  private facilityFeedListener: EventListener | null = null
  
  private isProcessingTick = false
  private lastTickRequestTime = 0
  
  private lastHeartbeatTime = 0
  private heartbeatInterval: number | null = null
  private lastNodes: InfraNode[] = []
  private lastApps: ApplicationDeployment[] = []
  private lastVMs: VirtualMachine[] = []
  private lastConnections: Connection[] = []
  private lastContracts: ActiveContract[] = []
  private lastNetworkLoad: number = 0
  
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

      // Listen for global facility feed toggles from UI
      this.facilityFeedListener = ((e: CustomEvent) => {
        if (this.worker) {
          this.worker.postMessage({
            type: 'FACILITY_FEED',
            payload: e.detail
          })
        }
      }) as EventListener
      window.addEventListener('infra:facilityFeedToggle', this.facilityFeedListener)
    }
  }

  public start() {

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
          performanceMonitor.updateSimMetrics(t.tickDurationMs, t.entityCount, t.systemTimings, t.queryTelemetry, t.simStats)
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
          this.init(this.lastNodes, this.lastApps, this.lastVMs, this.lastConnections, this.lastContracts, [], this.lastNetworkLoad)
        }
      }, 1000 * this.restartAttempts) // Exponential backoff-ish
    } else {
      performanceMonitor.setWorkerStatus('failed')
      console.error('[[WorkerManager]] Critical: Max restart attempts reached. Simulation halted.')
    }
  }

  private compactState(
    nodes: InfraNode[], 
    applications: ApplicationDeployment[], 
    connections: Connection[], 
    contracts: ActiveContract[],
    virtualMachines: VirtualMachine[],
    pods: PodData[],
    networkLoad: number,
    tickets: TechnicianTicket[],
    incidents: Incident[],
    automationPolicies: AutomationPolicy[],
    globalTargetFirmware: string
  ): SimInitPayload {

    const compactNodes = nodes.map(n => ({
      id: n.id,
      name: n.name || n.hostname || n.id.slice(0, 8),
      type: n.type,
      siteId: n.siteId,
      parentRackId: n.parentRackId,
      slotIndex: n.slotIndex,
      uHeight: n.uHeight,
      wattage: n.maintenanceMode ? 0 : (n.wattage ?? 0),
      catalogKey: n.catalogKey,
      maxPowerKW: n.maxPowerKW,
      currentPowerKW: n.maintenanceMode ? 0 : n.currentPowerKW,
      status: n.status,
      systemState: n.maintenanceMode ? 'off' : n.systemState,
      blankingPanels: n.blankingPanels,
      coolingMethod: n.coolingMethod,
      waterFlowLPM: n.waterFlowLPM,
      breakerTripped: n.breakerTripped,
      phase: n.phase,
      dualPSU: n.dualPSU,
      pduFeeds: n.pduFeeds,
      overloadSeconds: n.overloadSeconds,
      provisioningState: n.provisioningState,
      bootProgress: n.bootProgress ?? 0,
      temperature: n.temperature,
      isThrottled: n.isThrottled,
      btuOutput: n.btuOutput ?? 0,
      totalStorageTB: n.totalStorageTB,
      usedStorageTB: n.usedStorageTB,
      raidLevel: n.raidLevel,
      storageStatus: n.storageStatus,
      rebuildProgress: n.rebuildProgress,
      tier: n.tier,
      failedDrives: n.failedDrives,
      replicationSourceId: n.replicationSourceId,
      replicationProgress: n.replicationProgress,
      ioPSLimit: n.ioPSLimit,
      ioPSUsed: n.ioPSUsed,
      driveDegradation: n.driveDegradation,
      fanSpeedPercent: n.fanSpeedPercent,
      degradationPercent: (n.degradation ?? 0) * 100, // Convert 0-1 range to 0-100%
      containmentType: n.containmentType,
      healthStatus: n.healthStatus ?? 'healthy',
      infectionState: n.infectionState ?? 'clean',
      isBlackholed: n.isBlackholed ?? false,
      rateLimitGbps: n.rateLimitGbps,
      maintenanceMode: n.maintenanceMode ?? false,
      backupStatus: n.backupStatus,
      lastBackupTime: n.lastBackupTime,
      corruptionState: n.corruptionState,
      isIsolated: n.isIsolated ?? false,
      microsegmentationEnabled: n.microsegmentationEnabled ?? false,
      firmwareVersion: n.firmwareVersion,
      isFlashing: n.isFlashing ?? false
    }))

    const compactApps = applications.map(a => ({
      id: a.id,
      appId: a.appId,
      nodeId: a.nodeId,
      status: a.status,
      progress: a.progress,
      loadBalancerId: a.loadBalancerId,
      targetGroupIds: a.targetGroupIds
    }))

    const compactVMs = virtualMachines.map(v => ({
      id: v.id,
      nodeId: v.nodeId,
      status: v.status,
      cpuCores: v.cpuCores,
      memoryGB: v.memoryGB,
      storageGB: v.storageGB,
      migratingToNodeId: v.migratingToNodeId,
      migrationProgress: v.migrationProgress
    }))

    // Compact cabled connection links to minimum required wire frame
    const compactConnections = connections.map(c => ({
      id: c.id,
      startNodeId: c.startNodeId,
      startPortId: c.startPortId,
      endNodeId: c.endNodeId,
      endPortId: c.endPortId,
      bandwidthGbps: c.bandwidthGbps,
      throughputGbps: c.throughputGbps,
      latencyMs: c.latencyMs,
      isBlockedByCompliance: c.isBlockedByCompliance,
      status: c.status,
      syncProgress: c.syncProgress,
      type: c.type,
      packetLoss: c.packetLoss,
      controlQueueDelayMs: c.controlQueueDelayMs,
      bulkQueueDelayMs: c.bulkQueueDelayMs,
      packetsDropped: c.packetsDropped,
      isBlackholed: c.isBlackholed,
      rateLimitGbps: c.rateLimitGbps
    }))

    const compactContracts = contracts.map(c => ({
      id: c.id,
      blueprintId: c.blueprintId,
      totalTicks: c.totalTicks,
      uptimeTicks: c.uptimeTicks,
      accumulatedPenalty: c.accumulatedPenalty,
      currentStatus: c.currentStatus
    }))

    const compactPods = pods.map(p => ({
      id: p.id,
      nodeId: p.nodeId,
      clusterId: p.clusterId,
      status: p.status,
      cpuReq: p.cpuReq,
      memoryReq: p.memoryReq,
      serviceName: p.serviceName
    }))

    const compacted = {
      nodes: compactNodes,
      applications: compactApps,
      connections: compactConnections,
      contracts: compactContracts,
      virtualMachines: compactVMs,
      pods: compactPods,
      networkLoad,
      tickets,
      incidents,
      automationPolicies,
      globalTargetFirmware
    }
    return compacted
  }

  public init(nodes: InfraNode[], applications: ApplicationDeployment[], virtualMachines: VirtualMachine[] = [], connections: Connection[] = [], contracts: ActiveContract[] = [], pods: PodData[] = [], networkLoad: number = 0, tickets: TechnicianTicket[] = [], incidents: Incident[] = [], automationPolicies: AutomationPolicy[] = [], globalTargetFirmware: string = 'v1.0.0') {
    this.lastNodes = nodes
    this.lastApps = applications
    this.lastVMs = virtualMachines
    this.lastConnections = connections
    this.lastContracts = contracts
    this.lastNetworkLoad = networkLoad
    const compacted = this.compactState(nodes, applications, connections, contracts, virtualMachines, pods, networkLoad, tickets, incidents, automationPolicies, globalTargetFirmware)
    this.sendTransferable('INIT', compacted)
    this.restartAttempts = 0 // Reset on successful user-triggered init
  }

  public syncInput(nodes: InfraNode[], applications: ApplicationDeployment[], virtualMachines: VirtualMachine[] = [], connections: Connection[] = [], contracts: ActiveContract[] = [], pods: PodData[] = [], networkLoad: number = 0, tickets: TechnicianTicket[] = [], incidents: Incident[] = [], automationPolicies: AutomationPolicy[] = [], globalTargetFirmware: string = 'v1.0.0') {
    this.lastNodes = nodes
    this.lastApps = applications
    this.lastVMs = virtualMachines
    this.lastConnections = connections
    this.lastContracts = contracts
    this.lastNetworkLoad = networkLoad
    const compacted = this.compactState(nodes, applications, connections, contracts, virtualMachines, pods, networkLoad, tickets, incidents, automationPolicies, globalTargetFirmware)
    this.sendTransferable('SYNC_INPUT', compacted)
  }

  public requestTick(dt = 1.0) {
    if (!this.worker || this.isRestarting) return 
    if (this.isProcessingTick) {
      this.droppedTicksCount++
      performanceMonitor.updateBackpressure(this.droppedTicksCount, this.successfulTicksCount)
      return
    }
    this.isProcessingTick = true
    this.successfulTicksCount++
    performanceMonitor.updateBackpressure(this.droppedTicksCount, this.successfulTicksCount)
    this.lastTickRequestTime = performance.now()
    this.send('TICK', { dt })
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
  private send(type: 'TICK', payload: { dt: number }): void
  private send(type: 'TERMINAL_CMD', payload: any): void
  private send(type: 'PING'): void
  private send(type: string, payload?: any) {
    if (this.worker) {
      this.worker.postMessage({ type, payload })
    }
  }

  public sendTerminalCommand(payload: any) {
    this.send('TERMINAL_CMD', payload)
  }

  private sendTransferable(type: string, payload: any) {
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
    if (this.facilityFeedListener && typeof window !== 'undefined') {
      window.removeEventListener('infra:facilityFeedToggle', this.facilityFeedListener)
      this.facilityFeedListener = null
    }
  }
}

export const simWorkerManager = new SimulationWorkerManager()

