import { Vector3 } from 'three'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  HARDWARE_CATALOG,
  type HardwareCatalogKey,
  type PortType,
} from '../physics/hardwareLibrary'

import { CONTRACT_CATALOG } from '../physics/contractLibrary'

export {
  HARDWARE_CATALOG,
  type HardwareCatalogKey,
  type PortType,
}
import { TECHNICAL_MANUALS } from '../physics/Manuals'
import { findFirstEmptySlot } from '../physics/snapping'
import { calculateRackPower, recalculateRoomStats } from '../physics/powerEngine'
import { useMissionStore } from './useMissionStore'
import type { TerminalPane, TerminalSession } from './terminalTypes'
import { audioManager } from '../utils/AudioManager'
import { simWorkerManager } from '../simulation/SimulationWorkerManager'
import { performanceMonitor } from '../simulation/PerformanceMonitor'
import type { SimSyncOutputPayload } from '../simulation/worker/workerTypes'

export type * from './infraTypes'
import type { 
  InfraNode, 
  Connection, 
  CloudLink, 
  Site, 
  InfraAlert, 
  AuditLog, 
  DnsRecord, 
  DhcpLease, 
  NtpSyncStatus, 
  PostMortem, 
  Blueprint, 
  ApplicationDeployment,
  ServiceType,
  ServiceStatus,
  SaveMetadata,
  HardwarePort,
  ComponentHealth,
  ActiveContract,
  NodeService
} from './infraTypes'


type InfraState = {
  nodes: InfraNode[]
  connections: Connection[]
  cloudLinks: CloudLink[]
  cloudEgressGB: number
  totalPowerKW: number
  totalRoomBTU: number
  overloadedRackCount: number
  selectedNodeId: string | null
  patchingActive: boolean
  activePatchSource: { nodeId: string; portId: string } | null
  mousePosition: Vector3 | null
  sites: Site[]
  currentSiteId: string
  placementMode: boolean
  pendingRackType: string | null
  alerts: InfraAlert[]
  auditLogs: AuditLog[]
  isNetworkManagerOpen: boolean
  networkLoad: number
  resilienceIndex: number
  // v2.0 SDDC Metrics
  operationalBudget: number
  capacityUnits: number
  simulationCycle: number
  dnsRecords: DnsRecord[]
  dhcpLeases: DhcpLease[]
  availableIPPool: string[]
  ntpSyncStatus: NtpSyncStatus[]
  networkUptime: number
  postMortems: PostMortem[]
  blueprints: Blueprint[]
  previewBlueprintId: string | null
  
  // v5.0 Service Layer
  applications: ApplicationDeployment[]
  
  // Day 6: Enterprise Management Console
  terminalStates: Record<string, {
    sessions: TerminalSession[]
    activeSessionId: string
    layout: {
      width: number
      height: number
      x: number
      y: number
      isMaximized: boolean
    }
    aliases: Record<string, string>
    envVars: Record<string, string>
    storedFiles: Record<string, string>
  }>
  
  // v6.0 Economy & Progression
  balance: number
  reputation: number
  activeContracts: ActiveContract[]
  acceptContract: (blueprintId: string) => void
  cancelContract: (id: string) => void
  
  // v7.0 Global & Hybrid
  cloudBurstingActive: boolean
  activeCloudInstances: number
  setCloudBursting: (active: boolean) => void
  isGlobalMapOpen: boolean
  toggleGlobalMap: () => void
  assistantTargetId: string | null
  isAutoPilot: boolean
  
  // Day 5: Procurement & Thermal
  deploymentQueue: HardwareCatalogKey[]
  isHeatMapVisible: boolean
  toggleHeatMap: () => void
  saveSiteAsBlueprint: (name: string) => void
  applyBlueprint: (id: string) => void
  
  setNetworkLoad: (load: number) => void
  setNetworkManagerOpen: (open: boolean) => void
  setCurrentSiteId: (siteId: string) => void
  setMousePosition: (pos: Vector3 | null) => void
  processAutoBackups: () => void
  acknowledgeAllAlerts: () => void
  pushAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId?: string) => void
  acknowledgeAlert: (id: string) => void
  simulateRandomFailure: () => void
  simulateDataCorruption: () => void
  // Day 29 Actions
  processAging: () => void
  refreshHardware: (nodeId: string) => void
  repairHardware: (nodeId: string) => void
  installService: (nodeId: string, type: ServiceType) => void
  toggleService: (nodeId: string, serviceId: string, status: ServiceStatus) => void
  // Day 30 Actions
  processCommand: (text: string) => void
  generateFinalReport: () => { score: number, grade: string, breakdown: unknown }
  
  // Terminal Actions
  updateTerminalLayout: (layout: Partial<{ width: number; height: number; x: number; y: number; isMaximized: boolean }>) => void
  addTerminalSession: (title?: string, initialContext?: { mode: 'global' | 'ssh' | 'nano' | 'top', targetId: string | null }) => void
  closeTerminalSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  splitTerminalPane: (direction: 'vertical' | 'horizontal') => void
  setActivePane: (paneId: string) => void
  closeTerminalPane: (paneId: string) => void
  setTerminalAlias: (name: string, command: string) => void
  setTerminalEnvVar: (name: string, value: string) => void
  writeTerminalFile: (path: string, content: string) => void
  isTerminalOpen: boolean
  setIsTerminalOpen: (val: boolean) => void
  
  // v5.0 Service Layer Actions
  deployApplication: (appId: string, nodeId: string) => void
  removeApplication: (id: string) => void
  
  // Infrastructure Core Actions
  processTick: () => void
  
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  handlePortClick: (nodeId: string, portId: string) => void
  removeConnection: (id: string) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
  advanceProvisioningState: (id: string) => void
  
  // Day 7: Logical Networking
  verifyService: (nodeId: string, type: ServiceType) => boolean
  patchConnection: (sNodeId: string, sPortId: string, tNodeId: string, tPortId: string) => void
  getServiceStatus: (type: ServiceType) => 'green' | 'red'
  setPreviewBlueprint: (id: string | null) => void
  exportToTerraform: (siteId: string) => string
  runComplianceCheck: (siteId: string) => { type: 'error' | 'warning'; message: string }[]
  ping: (sourceId: string, targetIp: string) => { success: boolean; message: string }
  
  // v1.6 Orchestration Actions
  addDnsRecord: (record: Omit<DnsRecord, 'id'>) => void
  removeDnsRecord: (id: string) => void
  autoPatchRack: (rackId: string) => void
  syncNtp: (nodeId: string) => void
  
  // v1.6 Logic Reset Actions
  powerOnNode: (nodeId: string) => void
  setNodeHostname: (nodeId: string, name: string) => void
  assignNetworkDetails: () => void
  checkNetworkPath: (startId: string, endId: string) => boolean
  resetState: () => void

  // ECS Sync
  getSimulationTelemetry: () => any
  initializeSimulation: () => void
  handleWorkerOutput: (payload: SimSyncOutputPayload) => void

  // v2.0 Management Plane Additions
  isChaosMode: boolean
  validateReplication: (linkId: string) => boolean
  addReplicationLink: (sourceId: string, targetId: string) => void
  checkAllCompliance: () => void
  updateTerminalLogs: (sessionId: string, paneId: string, logs: string[]) => void
  finalRemoveNode: (id: string) => void
  visualizePath: (startId: string, endId: string) => void
  fixState: () => void

  // Phase 10: Save System
  saveGame: (slotId: string) => void
  loadGame: (slotId: string) => void
  getAvailableSaves: () => SaveMetadata[]
  isSaveManagerOpen: boolean
  updateSite: (id: string, updates: Partial<Site>) => void
}

const catalogDisplayName: Record<HardwareCatalogKey, string> = {
  // COMPUTE
  BLADE_CHASSIS_4U: 'Blade Chassis (4U)',
  BLADE_SERVER: 'Blade Server',
  GPU_NODE_2U: 'GPU Node (2U)',
  COMPUTE_1U: 'Compute (1U)',
  // STORAGE
  SAN_CONTROLLER_2U: 'SAN Controller (2U)',
  DISK_SHELF_2U: 'Disk Shelf (2U)',
  NVME_ARRAY_1U: 'NVMe Flash Array (1U)',
  // NETWORKING
  LEAF_SWITCH_1U: 'Leaf Switch (1U)',
  SPINE_SWITCH_2U: 'Spine Switch (2U)',
  VPN_GATEWAY_1U: 'VPN Gateway (1U)',
  // SECURITY
  NG_FIREWALL_1U: 'NG-Firewall (1U)',
  SIEM_COLLECTOR_1U: 'SIEM Collector (1U)',
  IDS_IPS_NODE_2U: 'IDS/IPS Node (2U)',
  // IDENTITY
  DIRECTORY_SERVER_1U: 'Directory Server (1U)',
  HSM_MODULE_1U: 'HSM Module (1U)',
  // FACILITIES
  HIGH_DENSITY_PDU_1U: 'High-Density PDU (1U)',
  ENV_SENSOR: 'Environmental Sensor',
  IN_ROW_CRAC_4U: 'In-Row CRAC (4U)',
  RACK_42U: 'Server Rack (42U)',
}

function calculateGeoLatency(siteA: Site, siteB: Site): number {
  if (siteA.id === siteB.id) return 1 // Intra-site latency
  
  // Haversine-ish simplified distance
  const dLat = Math.abs(siteA.geoCoords.lat - siteB.geoCoords.lat)
  const dLng = Math.abs(siteA.geoCoords.lng - siteB.geoCoords.lng)
  const distance = Math.sqrt(dLat * dLat + dLng * dLng)
  
  // Rule of thumb: ~1ms per 100km round trip + processing overhead
  return Math.round(distance * 5) + 20 
}

function createPortsForCatalog(nodeId: string, key: HardwareCatalogKey): HardwarePort[] {
  const { portLayout } = HARDWARE_CATALOG[key]
  return portLayout.flatMap((segment) =>
    Array.from({ length: segment.count }, (_, idx) => ({
      id: `${nodeId}-${segment.type}-${idx + 1}`,
      type: segment.type,
      label: `${segment.labelPrefix}${idx + 1}`,
      connectedTo: null,
      status: 'down' as const,
      ip: undefined,
      mask: undefined
    }))
  )
}

const INITIAL_TERMINAL_STATE = {
  'site-1': { 
    sessions: [{ 
      id: 's1-1', 
      title: 'Primary Bastion', 
      panes: [{ id: 'p1-1', logs: ['Enterprise Console v2.0 Ready.'], history: [], cwd: '/', context: { mode: 'global' as const, targetId: null } }],
      activePaneId: 'p1-1',
      layout: 'single' as const
    }],
    activeSessionId: 's1-1',
    layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
    aliases: { 'll': 'ls -la', 'netstat': 'show ip int brief' },
    envVars: { 'DOMAIN': 'infra.local', 'USER': 'admin' },
    storedFiles: { '/etc/motd': 'Welcome to Global Infrastructure Management v2.0\nSecurity Authorized Personnel Only.' }
  }
}

export const useInfraStore = create<InfraState>()(
  persist(
    (set, get) => ({
      nodes: [],
      connections: [],
      cloudLinks: [],
      cloudEgressGB: 0,
      totalPowerKW: 0,
      totalRoomBTU: 0,
      overloadedRackCount: 0,
      selectedNodeId: null,
      patchingActive: false,
      activePatchSource: null,
      mousePosition: null,
      sites: [
        { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } },
        { id: 'site-2', name: 'DR-Site', isDisaster: false, region: 'US-East', energySource: 'Grid', geoCoords: { lat: 40.71, lng: -74.00 } }
      ] as Site[],
      currentSiteId: 'site-1',
      placementMode: false,
      pendingRackType: null,
      alerts: [],
      auditLogs: [],
       isNetworkManagerOpen: false,
       isTerminalOpen: false,
       setIsTerminalOpen: (val: boolean) => set({ isTerminalOpen: val }),
      networkLoad: 0.1,
      resilienceIndex: 100,
      postMortems: [],
      incidentCounter: 400,
      isAutoPilot: false,
      assistantTargetId: null,
      isSaveManagerOpen: false,
      terminalStates: INITIAL_TERMINAL_STATE,
      deploymentQueue: [],
      isHeatMapVisible: false,
      simulationCycle: 0,
      balance: 1000000,
      reputation: 85,
      activeContracts: [],
      isGlobalMapOpen: false,
      cloudBurstingActive: false,
      activeCloudInstances: 0,
      dnsRecords: [],
      dhcpLeases: [],
      availableIPPool: Array.from({ length: 154 }, (_, i) => `10.0.0.${101 + i}`),
      ntpSyncStatus: [],
      networkUptime: 100,
      operationalBudget: 1000000,
      capacityUnits: 0,
      blueprints: [],
      previewBlueprintId: null,
      applications: [],
      
      // Day 6: Enterprise Management Console
      isChaosMode: false,


      setNetworkLoad: (load) => set({ networkLoad: load }),
      setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
      setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
      setMousePosition: (pos) => set({ mousePosition: pos }),
      toggleHeatMap: () => set(state => ({ isHeatMapVisible: !state.isHeatMapVisible })),
      toggleGlobalMap: () => set(state => ({ isGlobalMapOpen: !state.isGlobalMapOpen })),

      pushAlert: (severity, message, nodeId) => {
        if (severity === 'critical') audioManager.playEffect('error')
        else if (severity === 'warning') audioManager.playEffect('alert')
        
        set((state) => ({
          alerts: [{ id: crypto.randomUUID(), timestamp: Date.now(), severity, message, isAcknowledged: false, nodeId }, ...state.alerts].slice(0, 100)
        }))
      },

      acknowledgeAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.map(a => a.id === id ? { ...a, isAcknowledged: true } : a)
        }))
      },

      acknowledgeAllAlerts: () => {
        set((state) => ({
          alerts: state.alerts.map(a => ({ ...a, isAcknowledged: true }))
        }))
      },

      simulateRandomFailure: () => {
        const { nodes, pushAlert, updateNode } = get()
        const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
        if (hardware.length === 0) {
           pushAlert('info', 'No hardware available to simulate failure.')
           return
        }
        
        const target = hardware[Math.floor(Math.random() * hardware.length)]
        updateNode(target.id, { healthStatus: 'critical' })
        pushAlert('critical', `Hardware Failure: ${target.name} (${target.id.slice(0,6)}) has entered a critical state!`, target.id)
      },

      simulateDataCorruption: () => {
        const { nodes, pushAlert, updateNode } = get()
        const storages = nodes.filter(n => (n.type === 'storage' || n.type === 'backup' || n.type === 'compute') && (n.totalStorageTB ?? 0) > 0)
        if (storages.length === 0) return

        const shuffled = [...storages].sort(() => Math.random() - 0.5)
        const targets = shuffled.slice(0, Math.min(shuffled.length, Math.max(1, Math.floor(shuffled.length * 0.6))))
        let blocked = 0
        let infected = 0

        targets.forEach(target => {
          if (target.isImmutable) {
            blocked++
            pushAlert('info', `🛡️ THREAT BLOCKED: Ransomware attempt on ${target.name} thwarted by Immutable Snapshots!`, target.id)
          } else {
            infected++
            updateNode(target.id, { 
              isInfected: true, 
            })
            pushAlert('critical', `🦠 RANSOMWARE: ${target.name} encrypted! Entropy 100%. Data lost.`, target.id)
          }
        })

        if (infected > 0) {
          pushAlert('critical', `🔴 RANSOMWARE SIEGE: ${infected} node(s) encrypted, ${blocked} blocked by immutable snapshots.`)
        }
      },


      processAutoBackups: () => {
        const { nodes, pushAlert, updateNode } = get()
        let backedUpCount = 0
        nodes.forEach(n => {
          if ((n.type === 'compute' || n.type === 'storage' || n.type === 'backup') && n.backupStatus === 'unprotected') {
            updateNode(n.id, { backupStatus: 'protected' })
            backedUpCount++
          }
        })
        if (backedUpCount > 0) {
          pushAlert('info', `Backup Cycle Complete: ${backedUpCount} nodes secured and moved to protected state.`)
        }
      },

      processCloudTiering: () => {
        const { nodes, cloudLinks, pushAlert } = get()
        const newLinks: CloudLink[] = []
        nodes.forEach(n => {
          if ((n.type === 'storage' || n.type === 'backup') && (n.totalStorageTB ?? 0) > 0) {
            const usedPercent = ((n.usedStorageTB ?? 0) / n.totalStorageTB!) * 100
            const alreadyLinked = cloudLinks.some(cl => cl.nodeId === n.id)
            if (usedPercent >= 90 && !alreadyLinked) {
              const overflow = (n.usedStorageTB ?? 0) - (n.totalStorageTB! * 0.9)
              newLinks.push({ id: crypto.randomUUID(), nodeId: n.id, tieredTB: overflow })
              pushAlert('info', `CLOUD TIERING: ${n.name} at ${usedPercent.toFixed(0)}% capacity. ${overflow.toFixed(1)} TB auto-tiered to Cloud Object Storage.`, n.id)
            }
          }
        })
        if (newLinks.length > 0) {
          set(state => ({ cloudLinks: [...state.cloudLinks, ...newLinks] }))
        }
      },



      processAging: () => {
        const { simulationCycle, nodes, updateNode, pushAlert } = get()
        const newCycle = simulationCycle + 1
        set({ simulationCycle: newCycle })

        nodes.forEach(n => {
          if (n.type === 'rack' || n.type === 'cooling') return
          
          const age = newCycle - n.installDate
          const degradationDelta = (Math.random() * 0.05) * (1 + (n.failureProbability ?? 0))
          const newDegradation = Math.min(100, n.degradation + degradationDelta)
          
          let efficiencyPenalty = 1.0
          if (age > 1000) {
            efficiencyPenalty = 1.25 // 25% more power
          }

          const spec = n.catalogKey ? HARDWARE_CATALOG[n.catalogKey] : null
          const baseWattage = spec ? spec.wattage : n.wattage
          const updatedWattage = baseWattage * efficiencyPenalty * (1 + newDegradation / 200)
          
          const failureBoost = (newDegradation / 100) * 0.1
          const updatedFailureProb = Math.min(1, (n.failureProbability ?? 0) + failureBoost)

          updateNode(n.id, { 
            degradation: newDegradation, 
            wattage: updatedWattage, 
            failureProbability: updatedFailureProb 
          })

          if (newDegradation > 90 && n.healthStatus !== 'critical') {
            pushAlert('warning', `⚙️ END OF LIFE: ${n.name} has reached 90% degradation. Immediate refresh recommended.`, n.id)
          }
        })
      },

      refreshHardware: (nodeId) => {
        const { simulationCycle, updateNode, nodes, pushAlert } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        updateNode(nodeId, { isRefreshing: true })
        
        setTimeout(() => {
          const spec = node.catalogKey ? HARDWARE_CATALOG[node.catalogKey] : null
          updateNode(nodeId, {
            installDate: simulationCycle,
            degradation: 0,
            failureProbability: 0,
            wattage: spec ? spec.wattage : node.wattage,
            healthStatus: 'healthy',
            isRefreshing: false
          })
          
          pushAlert('info', `✅ REFRESH COMPLETE: ${node.name} modernized. Lifecycle cycle reset.`)
        }, 3000)
      },

      repairHardware: (nodeId) => {
        const { updateNode, pushAlert } = get()
        updateNode(nodeId, { isRefreshing: true })
        setTimeout(() => {
          updateNode(nodeId, {
            isRefreshing: false,
            healthStatus: 'healthy',
            failureProbability: 0.1
          })
          pushAlert('info', `🔧 REPAIR COMPLETE: ${nodeId.slice(0,6)} component service successful.`)
        }, 1500)
      },

      installService: (nodeId, type) => {
        const { nodes, pushAlert, updateNode } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        if (node.services?.some(s => s.type === type)) {
          pushAlert('warning', `Service ${type.toUpperCase()} is already installed on ${node.hostname || node.name}.`)
          return
        }

        const ports: Record<ServiceType, number> = { web: 80, storage: 445, backup: 5544, DHCP: 67, DNS: 53, NTP: 123 }
        const newService: NodeService = {
          id: crypto.randomUUID(),
          type,
          status: 'stopped',
          port: ports[type] || 0
        }

        updateNode(nodeId, { 
          services: [...(node.services || []), newService]
        })
        pushAlert('info', `Service ${type.toUpperCase()} installed on ${node.hostname || node.name}.`)
      },

      toggleService: (nodeId, serviceId, status) => {
        const { nodes, updateNode, pushAlert } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        updateNode(nodeId, {
          services: node.services.map(s => s.id === serviceId ? { ...s, status } : s)
        })
        pushAlert('info', `Service status changed to ${status.toUpperCase()} on ${node.name}.`)
      },

      updateTerminalLayout: (layout) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        set(s => ({
          terminalStates: {
            ...s.terminalStates,
            [siteId]: {
              ...state,
              layout: { 
                width: state.layout?.width || 700, 
                height: state.layout?.height || 450, 
                x: state.layout?.x || 100, 
                y: state.layout?.y || 100, 
                isMaximized: state.layout?.isMaximized || false,
                ...layout 
              }
            }
          }
        }))
      },

      addTerminalSession: (title = 'New Session', initialContext?: { mode: 'global' | 'ssh' | 'nano' | 'top', targetId: string | null }) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        const id = `s-${Math.random().toString(36).substr(2, 9)}`
        const paneId = `p-${Math.random().toString(36).substr(2, 9)}`
        const newSession: TerminalSession = {
          id,
          title,
          panes: [{ 
            id: paneId, 
            logs: [`Session ${title} started.`], 
            history: [], 
            cwd: '/', 
            context: initialContext || { mode: 'global', targetId: null } 
          }],
          activePaneId: paneId,
          layout: 'single'
        }
        set(s => ({
          isTerminalOpen: true, // Auto-open on new session
          terminalStates: {
            ...s.terminalStates,
            [siteId]: {
              ...state,
              sessions: [...(state.sessions || []), newSession],
              activeSessionId: id,
              layout: state.layout || { width: 850, height: 550, x: 100, y: 120, isMaximized: false }
            }
          }
        }))
      },

      splitTerminalPane: (direction) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        const session = state.sessions.find(s => s.id === state.activeSessionId)
        if (!session || session.panes.length >= 2) return // Simple 2-pane split for now

        const newPaneId = `p-${Math.random().toString(36).substr(2, 9)}`
        const activePane = session.panes.find(p => p.id === session.activePaneId) || session.panes[0]
        
        const newPane: TerminalPane = {
          ...activePane,
          id: newPaneId,
          logs: [`Pane split ${direction}.`],
          history: [...activePane.history]
        }

        const updatedSessions = state.sessions.map(s => 
          s.id === session.id ? { 
            ...s, 
            panes: [...s.panes, newPane], 
            activePaneId: newPaneId,
            layout: direction 
          } : s
        )

        set(s => ({
          terminalStates: {
            ...s.terminalStates,
            [siteId]: { ...state, sessions: updatedSessions }
          }
        }))
      },

      setActivePane: (paneId) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        const updatedSessions = state.sessions.map(s => 
          s.id === state.activeSessionId ? { ...s, activePaneId: paneId } : s
        )
        set(s => ({
          terminalStates: {
            ...s.terminalStates,
            [siteId]: { ...state, sessions: updatedSessions }
          }
        }))
      },

      closeTerminalPane: (paneId) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state || !state.activeSessionId) return
        
        const activeSession = state.sessions.find(s => s.id === state.activeSessionId)
        if (!activeSession) return

        if (activeSession.panes.length <= 1) {
          get().closeTerminalSession(state.activeSessionId)
          return
        }

        const newPanes = activeSession.panes.filter(p => p.id !== paneId)
        const newActivePaneId = activeSession.activePaneId === paneId ? newPanes[0].id : activeSession.activePaneId

        set(s => {
          const updated = { ...s.terminalStates }
          const updatedSessions = state.sessions.map(sess => {
            if (sess.id !== state.activeSessionId) return sess
            return { ...sess, panes: newPanes, activePaneId: newActivePaneId, layout: 'single' as const }
          })
          updated[siteId] = { ...state, sessions: updatedSessions }
          return { terminalStates: updated }
        })
      },

      setTerminalAlias: (name, command) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        set(s => {
          const updated = { ...s.terminalStates }
          updated[siteId] = { ...state, aliases: { ...state.aliases, [name]: command } }
          return { terminalStates: updated }
        })
      },

      setTerminalEnvVar: (name, value) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        set(s => {
          const updated = { ...s.terminalStates }
          updated[siteId] = { ...state, envVars: { ...state.envVars, [name]: value } }
          return { terminalStates: updated }
        })
      },

      writeTerminalFile: (path, content) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        set(s => {
          const updated = { ...s.terminalStates }
          updated[siteId] = { ...state, storedFiles: { ...state.storedFiles, [path]: content } }
          return { terminalStates: updated }
        })
      },

      closeTerminalSession: (sessionId) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state || !state.sessions || state.sessions.length <= 1) return
        
        const newSessions = state.sessions.filter(s => s.id !== sessionId)
        const newActiveId = state.activeSessionId === sessionId ? newSessions[0].id : state.activeSessionId
        
        set(s => ({
          terminalStates: {
            ...s.terminalStates,
            [siteId]: {
              ...state,
              sessions: newSessions,
              activeSessionId: newActiveId
            }
          }
        }))
      },

      setActiveSession: (sessionId) => {
        const siteId = get().currentSiteId
        const state = get().terminalStates[siteId]
        if (!state) return
        set(s => {
          const updated = { ...s.terminalStates }
          updated[siteId] = { ...state, activeSessionId: sessionId }
          return { terminalStates: updated }
        })
      },

      processCommand: (text) => {
        const siteId = get().currentSiteId
        const siteState = get().terminalStates[siteId]
        if (!siteState) return
        
        const activeSession = siteState.sessions.find(s => s.id === siteState.activeSessionId)
        if (!activeSession) return
        const activePane = activeSession.panes.find(p => p.id === activeSession.activePaneId) || activeSession.panes[0]

        const { nodes, updateNode, writeTerminalFile, setTerminalAlias, setTerminalEnvVar, dnsRecords } = get()
        
        const resolveHostname = (host: string) => {
          const record = dnsRecords.find(r => r.hostname === host)
          return record ? record.ip : host
        }
        
        // --- 1. ALIAS SUBSTITUTION ---
        let processedCmd = text.trim()
        const firstWord = processedCmd.split(/\s+/)[0]
        if (siteState.aliases[firstWord]) {
           processedCmd = siteState.aliases[firstWord] + processedCmd.slice(firstWord.length)
        }

        // --- 2. ENV VAR SUBSTITUTION ---
        processedCmd = processedCmd.replace(/\$(\w+)/g, (_, name) => siteState.envVars[name] || '')

        // --- 3. REDIRECTION ---
        let redirectPath: string | null = null
        if (processedCmd.includes('>')) {
          const parts = processedCmd.split('>')
          processedCmd = parts[0].trim()
          redirectPath = parts[1].trim()
        }

        // --- 4. PIPING SETUP ---
        const pipeParts = processedCmd.split('|').map(s => s.trim())
        const baseCmd = pipeParts[0]
        const args = baseCmd.split(/\s+/)
        const cmdLower = args[0].toLowerCase()

        let output: string[] = [] 
        let newContext = { ...activePane.context }
        const newCwd = activePane.cwd
        let forceClear = false

        // --- 5. CORE COMMAND LOGIC ---
        // --- 5. CORE COMMAND LOGIC ---
        const targetNode = nodes.find(n => n.id === newContext.targetId)

        // Day 1 Fidelity: Console access requires an OOB/Management connection
        if (newContext.mode === 'ssh' && targetNode) {
          const { connections } = get()
          const hasOobLink = connections.some(c => {
            const isTarget = c.startNodeId === targetNode.id || c.endNodeId === targetNode.id
            const sourcePort = nodes.find(n => n.id === c.startNodeId)?.ports.find(p => p.id === c.startPortId)
            const destPort = nodes.find(n => n.id === c.endNodeId)?.ports.find(p => p.id === c.endPortId)
            // In v1.6, we assume 'network' ports carry management traffic if patched
            return isTarget && (sourcePort?.type === 'network' || destPort?.type === 'network')
          })
          
          if (!hasOobLink && !['exit', 'help'].includes(cmdLower)) {
            output.push(`[[RED]]ERROR: No Serial/OOB connection to [${targetNode.hostname || targetNode.id.slice(0,8)}].[[RESET]]`)
            output.push("Verify physical Top-of-Rack patching to Management Switch.")
            // Use set directly since we are in processCommand
            set(s => {
              const cs = s.terminalStates[siteId]
              const ns = cs.sessions.map(sess => sess.id === activeSession.id ? {
                ...sess,
                panes: sess.panes.map(p => p.id === activePane.id ? { ...p, logs: [...p.logs, `> ${text}`, ...output].slice(-200) } : p)
              } : sess)
              return { terminalStates: { ...s.terminalStates, [siteId]: { ...cs, sessions: ns } } }
            })
            return
          }
        }

        if (cmdLower === 'help') {
          output.push("--- [[GREEN]]v1.6 BOOTSTRAP KERNEL[[RESET]] ---")
          output.push("BOOTSTRAP: [[YELLOW]]poweron[[RESET]], [[YELLOW]]hostname [n][[RESET]], [[YELLOW]]ip setup [ip] [gw] [dns][[RESET]]")
          output.push("OPS: [[BLUE]]lifecycle advance[[RESET]], [[BLUE]]ipmi status[[RESET]], [[BLUE]]ipmi power [on|off|cycle][[RESET]]")
          output.push("CORE: [[BLUE]]ls -la[[RESET]], [[BLUE]]cd[[RESET]], [[BLUE]]pwd[[RESET]], [[RED]]clear[[RESET]], [[BLUE]]man [topic][[RESET]]")
          output.push("NET: [[GREEN]]ping [target][[RESET]], [[GREEN]]show ip brief[[RESET]], [[GREEN]]traceroute[[RESET]]")
          output.push("ORCH: [[BLUE]]apt install[[RESET]], [[BLUE]]systemctl start[[RESET]], [[BLUE]]sync-ntp[[RESET]]")
          output.push("NAV: [[YELLOW]]scan console[[RESET]], [[YELLOW]]connect console [id][[RESET]], [[YELLOW]]exit[[RESET]]")
          output.push("SIM: [[BLUE]]ecs-stats[[RESET]], [[BLUE]]sim-telemetry[[RESET]]")
        } else if (targetNode && targetNode.systemState === 'off' && !['poweron', 'exit', 'help'].includes(cmdLower)) {
          output.push("[[RED]]SYSTEM ERROR: Node is logically powered down.[[RESET]]")
          output.push("Required: '[[YELLOW]]poweron[[RESET]]' to initialize CPU/RAM.")
        } else if (targetNode && targetNode.systemState === 'booting' && !['exit', 'help'].includes(cmdLower)) {
          output.push("[[YELLOW]]BOOT INTERRUPT: System is currently in POST/Kernel initialization.[[RESET]]")
          output.push(`Progress: ${targetNode.bootProgress}% | Please wait for success telemetry.`)
        } else if (targetNode && targetNode.systemState === 'running' && !targetNode.hostname && !['hostname', 'exit', 'help', 'ipmi'].includes(cmdLower)) {
          output.push("[[RED]]BOOT ERROR: Unique Hostname not set.[[RESET]]")
          output.push("Required: '[[YELLOW]]hostname [name][[RESET]]' to set node identity.")
        } else if (cmdLower === 'poweron') {
          if (newContext.mode === 'ssh' && targetNode) {
            get().powerOnNode(targetNode.id)
            output.push("[[GREEN]]Initializing Hardware Stack...[[RESET]]")
            output.push("POST: CPU Check [OK] | RAM Sync [OK] | Bus Scan [OK]")
            output.push("Kernel handover initiated. Boot sequence active.")
          } else output.push("[[RED]]poweron: must be connected to a node serial console.[[RESET]]")
        } else if (cmdLower === 'hostname') {
          const name = args[1]
          if (newContext.mode === 'ssh' && targetNode) {
            if (!name) output.push("usage: hostname [name]")
            else if (nodes.some(n => n.hostname === name && n.id !== targetNode.id)) {
              output.push(`[[RED]]NAME COLLISION: Hostname '${name}' is already registered on this subnet.[[RESET]]`)
            } else {
              get().setNodeHostname(targetNode.id, name)
              output.push(`[[GREEN]]Identity established: ${name}.infra.local[[RESET]]`)
            }
          } else output.push("[[RED]]hostname: must be connected to a node serial console.[[RESET]]")
        } else if (cmdLower === 'ip' && args[1] === 'setup') {
          const [,,ip, gw, dns] = args
          if (newContext.mode === 'ssh' && targetNode) {
            if (!ip || !gw || !dns) {
              output.push("usage: [[YELLOW]]ip setup [IP] [Gateway] [DNS][[RESET]]")
              output.push("Example: ip setup 10.0.0.5 10.0.0.1 1.1.1.1")
            } else if (nodes.some(n => n.managementIP === ip && n.id !== targetNode.id)) {
              output.push(`[[RED]]IP CONFLICT: ${ip} is already assigned to another interface.[[RESET]]`)
              output.push(`[[YELLOW]]ARP: Detected collision with MAC ${nodes.find(n => n.managementIP === ip)?.macAddress || 'unknown'}[[RESET]]`)
            } else {
              updateNode(targetNode.id, { managementIP: ip, isConfigured: true })
              output.push(`[[GREEN]]Logical Interface Configured:[[RESET]]`)
              output.push(`IP: ${ip} | GW: ${gw} | DNS: ${dns}`)
              output.push(`[[BLUE]]Link state: UP. ARP resolution active.[[RESET]]`)
            }
          } else output.push("[[RED]]ip setup: must be connected to a node serial console.[[RESET]]")
        } else if (cmdLower === 'ls') {
          output.push("[[BLUE]]bin[[RESET]]  [[BLUE]]etc[[RESET]]  [[BLUE]]root[[RESET]]  [[BLUE]]var[[RESET]]")
          Object.keys(siteState.storedFiles).forEach(f => output.push(`[[GREEN]]${f.split('/').pop()}[[RESET]]`))
        } else if (cmdLower === 'show' && args[1] === 'vlan' && args[2] === 'brief') {
          output.push("VLAN Name                             Status    Ports")
          output.push("---- -------------------------------- --------- -------------------------------")
          output.push("1    default                          active    Gi1/0/1, Gi1/0/2")
          output.push("10   Management                       active    Gi1/0/10")
        } else if (cmdLower === 'show' && args[1] === 'ip' && (args[2] === 'brief' || (args[2] === 'int' && args[3] === 'brief'))) {
          output.push("Interface       IP-Address      Status                Protocol")
          output.push("---------       ----------      ------                --------")
          nodes.filter(n => n.siteId === siteId && n.type !== 'rack').forEach(n => {
            const ip = n.managementIP || 'unassigned'
            const statusColor = n.systemState === 'running' ? '[[GREEN]]' : n.systemState === 'booting' ? '[[YELLOW]]' : '[[RED]]'
            const status = `${statusColor}${n.systemState.toUpperCase()}[[RESET]]`
            output.push(`${n.hostname || n.id.slice(0,8)}`.padEnd(15) + `${ip.padEnd(15)} ${status.padEnd(30)}`)
          })
        } else if (cmdLower === 'ping') {
          const target = args[1]
          if (!target) {
            output.push("usage: ping [IP_or_Hostname]")
          } else {
            const ip = resolveHostname(target)
            const targetNode = nodes.find(n => n.managementIP === ip || n.hostname === target)
            
            if (targetNode && get().checkNetworkPath(newContext.targetId || 'bastion', targetNode.id)) {
              get().visualizePath(newContext.targetId || 'bastion', targetNode.id)
              const result = get().ping(newContext.targetId || 'bastion', ip)
              if (result.success) {
                output.push(`[[BLUE]]PING ${target} (${ip}) 56(84) bytes of data.[[RESET]]`)
                for(let i=1; i<=3; i++) output.push(result.message.replace('seq=1', `seq=${i}`))
              } else {
                output.push(`[[RED]]${result.message}[[RESET]]`)
              }
            } else {
              output.push(`[[RED]]PING ${target} (${ip}): Request timed out. No route to host.[[RESET]]`)
            }
          }
        } else if (cmdLower === 'ssh') {
          const host = args[1]
          const ip = resolveHostname(host)
          const node = nodes.find(n => (n.managementIP === ip || n.hostname === host) && n.siteId === siteId)
          if (node) {
            if (node.systemState !== 'running') output.push(`[[RED]]ssh: connect to host ${host} port 22: Host is ${node.systemState.toUpperCase()}[[RESET]]`)
            else {
              newContext = { mode: 'ssh', targetId: node.id }
              output.push(`[[GREEN]]SSH: Connection established to ${node.hostname || node.name} (${ip})[[RESET]]`)
            }
          } else output.push(`[[RED]]ssh: connect to host ${host} port 22: Connection timed out[[RESET]]`)
        } else if (cmdLower === 'scan' && args[1] === 'console') {
          const unconfigured = nodes.filter(n => n.siteId === siteId && !n.managementIP && n.type !== 'rack')
          if (unconfigured.length === 0) output.push("[[GREEN]]Zero-Touch Scan: All local nodes provisioned.[[RESET]]")
          else {
            output.push("ID       NAME                 POWER    IP_STATUS")
            output.push("-------- -------------------- -------- ---------")
            unconfigured.forEach(n => {
              output.push(`${n.id.slice(0, 8)} ${n.name.padEnd(20)} ${n.systemState.toUpperCase().padEnd(8)} [[YELLOW]]PENDING[[RESET]]`)
            })
          }
        } else if (cmdLower === 'connect' && args[1] === 'console') {
          const targetId = args[2]
          const node = nodes.find(n => n.id.startsWith(targetId) && n.siteId === siteId)
          if (node) {
            newContext = { mode: 'ssh', targetId: node.id }
            output.push(`[[GREEN]]OOB Console: Serial link established to ${node.name}.[[RESET]]`)
            if (node.systemState === 'off') output.push("[[YELLOW]]System is currently Powered Off. Use 'poweron' to start.[[RESET]]")
            else if (node.systemState === 'booting') output.push(`[[YELLOW]]System is booting (${node.bootProgress}%). Please wait.[[RESET]]`)
          } else output.push(`[[RED]]connect: node '${targetId}' not found.[[RESET]]`)
        } else if (cmdLower === 'apt' && args[1] === 'install') {
          const pkg = args[2]
          const pkgMap: Record<string, ServiceType> = { 'bind9': 'DNS', 'isc-dhcp-server': 'DHCP', 'ntp': 'NTP' }
          if (pkgMap[pkg] && targetNode) {
            get().installService(targetNode.id, pkgMap[pkg])
          }
          output.push(`Reading package lists... Done`)
          output.push(`[[GREEN]]Unpacking ${pkg}... Done[[RESET]]`)
          output.push(`[[GREEN]]Setting up ${pkg}... Done[[RESET]]`)
        } else if (cmdLower === 'systemctl' && (args[1] === 'start' || args[1] === 'enable')) {
          const isEnableNow = args[1] === 'enable' && args[2] === '--now'
          const svcName = isEnableNow ? args[3] : args[2]
          const svcMap: Record<string, ServiceType> = { 'bind9': 'DNS', 'dhcp': 'DHCP', 'ntp': 'NTP', 'bind': 'DNS' }
          
          if (svcMap[svcName] && targetNode) {
            const service = targetNode.services.find(s => s.type === svcMap[svcName])
            if (service) {
              get().toggleService(targetNode.id, service.id, 'running')
              output.push(`[[GREEN]]Job for ${svcName}.service started successfully.[[RESET]]`)
            } else {
              output.push(`[[RED]]Failed to start ${svcName}.service: Unit not found.[[RESET]]`)
              output.push(`Required: '[[YELLOW]]apt install[[RESET]]' for this protocol.`)
            }
          } else {
            output.push(`[[GREEN]]Job for ${svcName}.service started successfully.[[RESET]]`)
          }
        } else if (cmdLower === 'lifecycle' && args[1] === 'advance') {
          if (newContext.targetId) {
            get().advanceProvisioningState(newContext.targetId)
            output.push("[[GREEN]]Lifecycle: Triggering state transition...[[RESET]]")
          } else output.push("[[RED]]lifecycle: must be connected to a node.[[RESET]]")
        } else if (cmdLower === 'ipmi') {
          if (!newContext.targetId || !targetNode) {
             output.push("[[RED]]ipmi: must be connected to a node serial console.[[RESET]]")
          } else {
            const sub = args[1]?.toLowerCase()
            if (sub === 'status') {
              output.push(`--- [[BLUE]]IPMI v2.0 - ${targetNode.hostname || targetNode.id.slice(0,8)}[[RESET]] ---`)
              output.push(`Power Status   : ${targetNode.systemState.toUpperCase()}`)
              output.push(`Temperature    : [[YELLOW]]${targetNode.temperature?.toFixed(2) || '??'}°C[[RESET]] (ECS-Calculated)`)
              output.push(`Fan Speed      : ${targetNode.systemState === 'running' ? '4500 RPM' : '0 RPM'}`)
              output.push(`Provisioning   : ${targetNode.provisioningState.toUpperCase()}`)
              output.push(`Throttling     : ${targetNode.isThrottled ? '[[RED]]ACTIVE[[RESET]]' : '[[GREEN]]OFF[[RESET]]'}`)
            } else if (sub === 'power') {
              const action = args[2]?.toLowerCase()
              if (action === 'on') {
                get().powerOnNode(targetNode.id)
                output.push("[[GREEN]]IPMI: Power-on signal sent.[[RESET]]")
              } else if (action === 'off') {
                updateNode(targetNode.id, { systemState: 'off', bootProgress: 0 })
                output.push("[[YELLOW]]IPMI: Graceful shutdown initiated.[[RESET]]")
              } else if (action === 'cycle') {
                updateNode(targetNode.id, { systemState: 'off', bootProgress: 0 })
                setTimeout(() => get().powerOnNode(targetNode.id), 2000)
                output.push("[[BLUE]]IPMI: Power cycle triggered (Hard Reset).[[RESET]]")
              } else output.push("usage: ipmi power [on|off|cycle]")
            } else if (sub === 'set-ip') {
              const ip = args[2]
              if (!ip) output.push("usage: ipmi set-ip [IP]")
              else {
                updateNode(targetNode.id, { managementIP: ip, isConfigured: true })
                output.push(`[[GREEN]]IPMI: Static IP assigned to out-of-band interface: ${ip}[[RESET]]`)
              }
            } else {
              output.push("usage: ipmi [status | power | set-ip]")
            }
          }
        } else if (cmdLower === 'sync-ntp') {
          if (newContext.targetId) {
            get().syncNtp(newContext.targetId)
            output.push("[[GREEN]]NTP: Clock synchronized with Stratum-2 source. Offset: 0.12ms[[RESET]]")
          } else output.push("[[RED]]sync-ntp: must be connected to a node.[[RESET]]")
        } else if (cmdLower === 'health') {
          if (targetNode && targetNode.componentHealth) {
            output.push(`--- [[BLUE]]HARDWARE TELEMETRY: ${targetNode.hostname || targetNode.id.slice(0,8)}[[RESET]] ---`)
            output.push(`OVERALL STATUS: ${targetNode.healthStatus === 'healthy' ? '[[GREEN]]OPTIMAL[[RESET]]' : '[[RED]]' + (targetNode.healthStatus || 'unknown').toUpperCase() + '[[RESET]]'}`)
            output.push("")
            output.push("COMPONENT          STATUS       DESCRIPTION")
            output.push("---------          ------       -----------")
            
            targetNode.componentHealth.cpu.forEach((s, i) => {
              const color = s === 'healthy' ? '[[GREEN]]' : '[[RED]]'
              output.push(`CPU_${i}`.padEnd(19) + `${color}${s.toUpperCase()}[[RESET]]`.padEnd(21) + (s === 'healthy' ? 'Executing instructions at 3.2GHz' : 'Thermal throttling detected'))
            })
            
            targetNode.componentHealth.ram.forEach((s, i) => {
              const color = s === 'healthy' ? '[[GREEN]]' : '[[RED]]'
              if (i < 4) // Show only first 4 to avoid clutter
                output.push(`DIMM_${i}`.padEnd(19) + `${color}${s.toUpperCase()}[[RESET]]`.padEnd(21) + (s === 'healthy' ? 'ECC verified' : 'Parity error'))
            })
            
            targetNode.componentHealth.drives.forEach((s, i) => {
              const color = s === 'healthy' ? '[[GREEN]]' : '[[RED]]'
              if (i < 4) // Show only first 4
                output.push(`DRIVE_${i}`.padEnd(19) + `${color}${s.toUpperCase()}[[RESET]]`.padEnd(21) + (s === 'healthy' ? 'S.M.A.R.T. OK' : 'Reallocation event'))
            })
          } else {
            output.push("[[RED]]health: command only available on physical hardware consoles.[[RESET]]")
          }
        } else if (cmdLower === 'config') {
          if (targetNode) {
            const subCmd = args[1]
            if (subCmd === 'ip') {
              const ip = args[2]
              const mask = args[3] || '255.255.255.0'
              if (!ip) output.push("usage: config ip [IP] [MASK]")
              else {
                updateNode(targetNode.id, { managementIP: ip })
                output.push(`[[GREEN]]Interface config updated. IP set to ${ip}/${mask}[[RESET]]`)
              }
            } else if (subCmd === 'vlan') {
              const vlanId = parseInt(args[2])
              if (isNaN(vlanId)) output.push("usage: config vlan [ID]")
              else {
                // Update first network port VLAN for simplicity in simulation
                const newPorts = targetNode.ports.map(p => p.type === 'network' ? { ...p, vlan: vlanId } : p)
                updateNode(targetNode.id, { ports: newPorts })
                output.push(`[[GREEN]]Native VLAN updated to ${vlanId} on all network interfaces.[[RESET]]`)
              }
            } else {
              output.push("usage: config [ip|vlan] ...")
            }
          } else {
            output.push("[[RED]]config: command only available on physical hardware consoles.[[RESET]]")
          }
        } else if (cmdLower === 'cat') {
          const path = args[1]
          if (siteState.storedFiles[path]) output.push(...siteState.storedFiles[path].split('\n'))
          else output.push(`[[RED]]cat: ${path}: No such file[[RESET]]`)
        } else if (cmdLower === 'exit') {
          if (newContext.mode !== 'global') {
            newContext = { mode: 'global', targetId: null }
            output.push("[[YELLOW]]Console detached.[[RESET]]")
          } else setTimeout(() => get().closeTerminalPane(activePane.id), 50)
        } else if (cmdLower === 'echo') {
          output.push(args.slice(1).join(' '))
        } else if (cmdLower === 'bootstrap') {
          output.push("--- [[GREEN]]v1.6 BOOTSTRAP PROTOCOL[[RESET]] ---")
          output.push("Step 1: [[YELLOW]]poweron[[RESET]]           - Initialize hardware stack")
          output.push("Step 2: [[YELLOW]]hostname [n][[RESET]]       - Set system identity")
          output.push("Step 3: [[YELLOW]]ip setup [ip] [gw] [dns][[RESET]] - Provision networking")
          output.push("")
          output.push("Note: Use '[[BLUE]]scan console[[RESET]]' to find unprovisioned nodes.")
          output.push(...(TECHNICAL_MANUALS.bootstrap || []))
        } else if (cmdLower === 'man') {
          const topic = args[1]
          if (TECHNICAL_MANUALS[topic]) output.push(...TECHNICAL_MANUALS[topic])
          else output.push(`[[RED]]No manual entry for ${topic}[[RESET]]`)
        } else if (cmdLower === 'clear') {
          forceClear = true
        } else if (cmdLower === 'export') {
          const pair = args[1]
          if (pair && pair.includes('=')) {
            const [key, val] = pair.split('=')
            setTerminalEnvVar(key, val)
            output.push(`[[GREEN]]EXPORT:[[RESET]] ${key} set to ${val}`)
          }
        } else if (cmdLower === 'alias') {
          const pair = args.slice(1).join(' ')
          if (pair && pair.includes('=')) {
            const eqIdx = pair.indexOf('=')
            const name = pair.slice(0, eqIdx).trim()
            let cmd = pair.slice(eqIdx + 1).trim()
            if ((cmd.startsWith('"') && cmd.endsWith('"')) || (cmd.startsWith("'") && cmd.endsWith("'"))) {
              cmd = cmd.slice(1, -1)
            }
            setTerminalAlias(name, cmd)
            output.push(`[[GREEN]]ALIAS:[[RESET]] ${name} -> ${cmd}`)
          }
        } else if (cmdLower === 'sh') {
          const path = args[1]
          if (siteState.storedFiles[path]) {
            const lines = siteState.storedFiles[path].split('\n')
            lines.forEach(line => {
              if (line.trim()) get().processCommand(line)
            })
            output.push(`[[BLUE]]Executing shell script: ${path}[[RESET]]`)
          } else output.push(`[[RED]]sh: ${path}: No such file[[RESET]]`)
        } else if (cmdLower === 'ecs-stats' || cmdLower === 'sim-telemetry') {
          const telemetry = get().getSimulationTelemetry()
          output.push("--- [[BLUE]]ECS SIMULATION TELEMETRY[[RESET]] ---")
          output.push(`Tick Duration : [[GREEN]]${telemetry.tickDurationMs.toFixed(4)}ms[[RESET]]`)
          output.push(`Entities      : [[YELLOW]]${telemetry.entityCount}[[RESET]]`)
          output.push(`Last Sync     : ${new Date(telemetry.lastTickTime).toLocaleTimeString()}`)
          output.push("")
          output.push("SYSTEM BREAKDOWN:")
          Object.entries(telemetry.systemTimings || {}).forEach(([name, time]) => {
            const t = (time as number).toFixed(4)
            output.push(`  ${name.padEnd(20)}: ${t}ms`)
          })
        } else if (cmdLower === 'sim-diagnostics') {
          output.push("--- [[YELLOW]]SIMULATION DIAGNOSTICS[[RESET]] ---")
          output.push(`Worker Status : [[GREEN]]ACTIVE[[RESET]]`)
          output.push(`Memory Profile: [[BLUE]]STABLE[[RESET]]`)
          output.push(`Frame Stability: ${performanceMonitor.getMetrics().fps} FPS`)
          output.push(`Thread Latency: ${performanceMonitor.getMetrics().workerLatency.toFixed(2)}ms`)
          output.push("Health Check  : 100% Deterministic")
        } else {
          output.push(`-bash: [[YELLOW]]${cmdLower}[[RESET]]: command not found`)
        }

        // --- 6. APPLY PIPES (GREP, TAIL, HEAD) ---
        for (let i = 1; i < pipeParts.length; i++) {
           const part = pipeParts[i]
           if (part.startsWith('grep ')) {
              const pattern = part.slice(5).trim().replace(/^["']|["']$/g, '')
              output = output.filter(line => new RegExp(pattern, 'i').test(line))
              // Add highlighting
              output = output.map(line => line.replace(new RegExp(`(${pattern})`, 'gi'), '[[YELLOW]]$1[[RESET]]'))
           } else if (part.startsWith('tail')) {
              output = output.slice(-10)
           } else if (part.startsWith('head')) {
              output = output.slice(0, 10)
           }
        }

        // --- 7. FINAL REDIRECTION ---
        if (redirectPath) {
           writeTerminalFile(redirectPath, output.join('\n'))
           output = [`[Output redirected to ${redirectPath}]`]
        }

        set(s => {
          const currentSiteState = s.terminalStates[siteId]
          if (!currentSiteState) return {}
          
          const finalSessions = currentSiteState.sessions.map(s => {
            if (s.id !== activeSession.id) return s
            const updatedPanes = s.panes.map(p => {
               if (p.id !== activePane.id) return p
               return {
                  ...p,
                  logs: forceClear ? [] : [...p.logs, `> ${text}`, ...output].slice(-200),
                  history: [...p.history, text].slice(-100),
                  context: newContext,
                  cwd: newCwd
               }
            })
            return { ...s, panes: updatedPanes }
          })

          return {
            terminalStates: {
              ...s.terminalStates,
              [siteId]: { ...currentSiteState, sessions: finalSessions }
            }
          }
        })
      },

      toggleAutoPilot: () => set(state => ({ isAutoPilot: !state.isAutoPilot })),

      processAutoPilot: () => {
        const { nodes, isAutoPilot, refreshHardware } = get()
        if (!isAutoPilot) return

        // Auto-fix EOL gear
        const eolNode = nodes.find(n => n.degradation > 85 && !n.isRefreshing)
        if (eolNode) {
          set({ assistantTargetId: eolNode.parentRackId || eolNode.id })
          refreshHardware(eolNode.id)
        }

        // Auto-replicate unprotected PII (Intra-region)
        const piiNode = nodes.find(n => n.dataCategory === 'PII' && n.type === 'storage' && !n.isRefreshing)
        if (piiNode) {
          const hasBackup = get().connections.some(c => c.startNodeId === piiNode.id || c.endNodeId === piiNode.id)
          if (!hasBackup) {
            const target = nodes.find(n => n.id !== piiNode.id && n.type === 'backup' && n.siteId === piiNode.siteId && get().validateReplication(piiNode.id))
            if (target) {
              set({ assistantTargetId: piiNode.parentRackId || piiNode.id })
              get().addReplicationLink(piiNode.id, target.id)
            }
          }
        }
      },


      setPlacementMode: (mode, type = null) => set({ placementMode: mode, pendingRackType: type }),

      addNode: (node) => {
        const { pushAlert, simulationCycle, currentSiteId } = get()
        
        const assetTag = node.assetTag || `ACC-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const normalizedNode: InfraNode = {
          ...node,
          siteId: node.siteId || currentSiteId,
          assetTag,
          installDate: node.installDate ?? simulationCycle,
          degradation: node.degradation ?? 0,
          services: node.services || [],
          systemState: node.systemState || 'off',
          bootProgress: node.bootProgress || 0,
          provisioningState: node.provisioningState || (node.parentRackId ? 'racked' : 'unboxed'),
          ports: node.ports?.length > 0 ? node.ports : (node.catalogKey ? createPortsForCatalog(node.id, node.catalogKey as HardwareCatalogKey) : []),
          componentHealth: node.componentHealth || {
            cpu: Array(node.type === 'compute' ? 2 : 1).fill('healthy'),
            ram: Array(node.type === 'compute' ? 8 : 4).fill('healthy'),
            drives: Array(node.type === 'storage' ? 12 : 2).fill('healthy')
          }
        }

        set((state) => ({ 
          nodes: [...state.nodes, normalizedNode]
        }))

        if (normalizedNode.type === 'rack') {
          calculateRackPower(normalizedNode.id)
          pushAlert('info', `DEPLOYED: ${normalizedNode.name} anchored at site grid.`)
          useMissionStore.getState().completeObjective('m1', 'm1_obj1')
        } else if (normalizedNode.parentRackId) {
          calculateRackPower(normalizedNode.parentRackId)
          if (normalizedNode.type === 'network') {
            useMissionStore.getState().completeObjective('m1', 'm1_obj2')
          } else if (normalizedNode.type === 'compute') {
            useMissionStore.getState().completeObjective('m1', 'm1_obj3')
          } else if (normalizedNode.type === 'facility' && normalizedNode.catalogKey === 'HIGH_DENSITY_PDU_1U') {
            useMissionStore.getState().completeObjective('m2', 'm2_obj2')
          }
        }
        recalculateRoomStats()
      },

      placeCatalogHardware: (key, targetRackId) => {
        const { nodes, deploymentQueue, simulationCycle } = get()
        const targetRack = nodes.find(n => n.id === targetRackId)
        if (!targetRack || targetRack.type !== 'rack') return false
        
        const spec = HARDWARE_CATALOG[key]

        // Blade Logic: Blade Servers can only be placed inside a Blade Chassis
        if ('isBlade' in spec && spec.isBlade) {
          const hasChassis = nodes.some(n => n.parentRackId === targetRackId && n.catalogKey && 'isBladeChassis' in HARDWARE_CATALOG[n.catalogKey] && (HARDWARE_CATALOG[n.catalogKey] as { isBladeChassis?: boolean }).isBladeChassis)
          if (!hasChassis) {
            get().pushAlert('warning', 'Blade Servers require a Blade Chassis for installation.')
            return false
          }
        }

        const targetNodes = nodes.filter(n => n.id === targetRackId || n.parentRackId === targetRackId)
        
        let placement;
        if ('isBlade' in spec && spec.isBlade) {
          // Blade servers reside inside the chassis and don't occupy U slots
          placement = { rackId: targetRackId, slotIndex: -1 }
        } else {
          placement = findFirstEmptySlot(targetNodes, spec.uHeight)
        }

        if (!placement) {
          window.alert('No free slot found in the selected rack.')
          return false
        }
        
        const node: InfraNode = {
          id: crypto.randomUUID(),
          catalogKey: key,
          type: spec.type,
          name: spec.name || catalogDisplayName[key],
          siteId: targetRack.siteId,
          position: new Vector3(targetRack.position.x, targetRack.position.y, targetRack.position.z),
          uHeight: spec.uHeight,
          wattage: spec.wattage,
          btuOutput: (spec as { btuOutput?: number }).btuOutput !== undefined ? (spec as { btuOutput?: number }).btuOutput! : spec.wattage * 3.41,
          totalStorageTB: spec.storageTB,
          usedStorageTB: spec.storageTB > 0 ? Math.floor(Math.random() * (spec.storageTB * 0.7) + (spec.storageTB * 0.3)) : 0,
          parentRackId: targetRackId,
          slotIndex: placement.slotIndex,
          healthStatus: 'healthy',
          degradation: 0,
          installDate: simulationCycle,
          installTimestamp: Date.now(),
          ports: [],
          services: [],
          systemState: 'off',
          bootProgress: 0,
          provisioningState: 'racked',
          componentHealth: {
            cpu: Array(spec.type === 'compute' ? 2 : 1).fill('healthy'),
            ram: Array(spec.type === 'compute' ? 8 : 4).fill('healthy'),
            drives: Array(spec.storageTB > 0 ? 12 : 2).fill('healthy')
          }
        }

        get().addNode(node)
        
        // Remove the FIRST occurrence of this key from the deployment queue
        const qIdx = deploymentQueue.indexOf(key)
        if (qIdx !== -1) {
          const newQueue = [...deploymentQueue]
          newQueue.splice(qIdx, 1)
          set({ deploymentQueue: newQueue })
        }

        return true
      },

      setSelectedNode: (id) => set((state) => {
        if (state.patchingActive && id !== null) return { selectedNodeId: id }
        return { selectedNodeId: id, patchingActive: false, activePatchSource: null }
      }),
 
      handlePortClick: (nodeId, portId) => {
        const { patchingActive, activePatchSource, nodes } = get()
        audioManager.playEffect('click')
        
        if (!patchingActive) set({ patchingActive: true, activePatchSource: { nodeId, portId } })
        else {
          if (activePatchSource?.nodeId === nodeId && activePatchSource?.portId === portId) {
            set({ patchingActive: false, activePatchSource: null })
            return
          }

          const sourceNode = nodes.find(n => n.id === activePatchSource!.nodeId)
          const sourcePort = sourceNode?.ports.find(p => p.id === activePatchSource!.portId)
          const targetNode = nodes.find(n => n.id === nodeId)
          const targetPort = targetNode?.ports.find(p => p.id === portId)

          if (sourcePort && targetPort && sourcePort.type !== targetPort.type) {
            get().pushAlert('critical', `MISWIRE DETECTED: Incompatible physical layer. Cannot connect ${sourcePort.type.toUpperCase()} to ${targetPort.type.toUpperCase()}.`)
            set({ patchingActive: false, activePatchSource: null })
            return
          }
          
          const isBlocked = !get().validateReplication(activePatchSource!.nodeId)
          
          const newConnection: Connection = {
            id: crypto.randomUUID(),
            startNodeId: activePatchSource!.nodeId,
            startPortId: activePatchSource!.portId,
            endNodeId: nodeId,
            endPortId: portId,
            bandwidthGbps: 100,
            throughputGbps: 0,
            latencyMs: 1,
            isBlockedByCompliance: isBlocked,
            status: isBlocked ? 'blocked' : 'active',
            syncProgress: 0,
            type: sourcePort?.type
          }
          set((state) => ({
            connections: [...state.connections, newConnection],
            nodes: state.nodes.map(n => 
              (n.id === nodeId || n.id === activePatchSource!.nodeId) 
              ? { 
                  ...n, 
                  provisioningState: n.provisioningState === 'racked' ? 'patched' : n.provisioningState,
                  ports: n.ports.map(p => (p.id === portId || p.id === activePatchSource!.portId) ? { ...p, status: 'negotiating' } : p)
                } 
              : n
            ),
            patchingActive: false,
            activePatchSource: null,
          }))

          // Transition from negotiating to up after 2 seconds
          setTimeout(() => {
            set(state => ({
              nodes: state.nodes.map(n => 
                (n.id === nodeId || n.id === activePatchSource!.nodeId)
                ? { ...n, ports: n.ports.map(p => (p.id === portId || p.id === activePatchSource!.portId) ? { ...p, status: 'up' } : p) }
                : n
              )
            }))
          }, 2000)

          useMissionStore.getState().completeObjective('m2', 'm2_obj1')
        }
      },

      replaceComponent: (nodeId: string, type: string, index: number) => {
        set(state => ({
          nodes: state.nodes.map(n => n.id === nodeId && n.componentHealth ? {
            ...n,
            componentHealth: {
              ...n.componentHealth,
              [type]: n.componentHealth[type as keyof ComponentHealth].map((h, i) => i === index ? 'healthy' : h)
            }
          } : n)
        }))
      },

      addReplicationLink: (sourceId, targetId) => {
        const { nodes, validateReplication } = get()
        const isBlocked = !validateReplication(sourceId)
        
        const sNode = nodes.find(n => n.id === sourceId)
        const tNode = nodes.find(n => n.id === targetId)
        if (!sNode || !tNode) return

        const sPort = sNode.ports.find(p => p.type === 'network') || sNode.ports[0]
        const tPort = tNode.ports.find(p => p.type === 'network') || tNode.ports[0]
        if (!sPort || !tPort) return

        const newConnection: Connection = {
          id: crypto.randomUUID(),
          startNodeId: sourceId,
          startPortId: sPort.id,
          endNodeId: targetId,
          endPortId: tPort.id,
          bandwidthGbps: 100,
          throughputGbps: 0,
          latencyMs: 1,
          isBlockedByCompliance: isBlocked,
          status: isBlocked ? 'blocked' : 'active',
          syncProgress: 0,
          type: sPort.type
        }
        set((state) => ({ connections: [...state.connections, newConnection] }))
      },

      removeConnection: (id) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
      })),

      removeNode: (id) => {
        const nodeToRemove = get().nodes.find(n => n.id === id)
        if (!nodeToRemove) return
        
        // If it's hardware, trigger the 'decommissioning' animation first
        if (nodeToRemove.type !== 'rack') {
          get().updateNode(id, { provisioningState: 'decommissioning' })
          return
        }

        const parentRackId = nodeToRemove.parentRackId
        set((state) => {
          const idsToRemove = new Set([id])
          if (nodeToRemove.type === 'rack') {
            state.nodes.forEach(n => { if (n.parentRackId === id) idsToRemove.add(n.id) })
          }
          return {
            nodes: state.nodes.filter(n => !idsToRemove.has(n.id)),
            connections: state.connections.filter(c => !idsToRemove.has(c.startNodeId) && !idsToRemove.has(c.endNodeId)),
            selectedNodeId: idsToRemove.has(state.selectedNodeId || '') ? null : state.selectedNodeId
          }
        })
        if (parentRackId) calculateRackPower(parentRackId)
        recalculateRoomStats()
      },

      finalRemoveNode: (id) => {
        const nodeToRemove = get().nodes.find(n => n.id === id)
        if (!nodeToRemove) return
        const parentRackId = nodeToRemove.parentRackId
        set((state) => ({
          nodes: state.nodes.filter(n => n.id !== id),
          connections: state.connections.filter(c => c.startNodeId !== id && c.endNodeId !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
        }))
        if (parentRackId) calculateRackPower(parentRackId)
        recalculateRoomStats()
      },

      updateNode: (id, updates) => {
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        }))
        if (updates.dataCategory) {
          get().checkAllCompliance()
        }
      },

      updatePort: (nodeId: string, portId: string, updates: Partial<HardwarePort>) => {
        set(state => ({
          nodes: state.nodes.map(n => n.id === nodeId ? {
            ...n,
            ports: n.ports.map(p => p.id === portId ? { ...p, ...updates } : p)
          } : n)
        }))
      },


      saveSiteAsBlueprint: (name: string) => {
        const { nodes, connections, currentSiteId } = get()
        const siteNodes = nodes.filter(n => n.siteId === currentSiteId)
        const siteConnections = connections.filter(c => {
          const startNode = nodes.find(n => n.id === c.startNodeId)
          const endNode = nodes.find(n => n.id === c.endNodeId)
          return startNode?.siteId === currentSiteId && endNode?.siteId === currentSiteId
        })
        const newBlueprint: Blueprint = {
          id: crypto.randomUUID(),
          name,
          nodes: JSON.parse(JSON.stringify(siteNodes)),
          connections: JSON.parse(JSON.stringify(siteConnections)),
          createdAt: Date.now()
        }
        set(state => ({ blueprints: [...state.blueprints, newBlueprint] }))
      },

      applyBlueprint: (id: string) => {
        const { blueprints, currentSiteId, nodes, connections } = get()
        const blueprint = blueprints.find(b => b.id === id)
        if (!blueprint) return
        
        const otherNodes = nodes.filter(n => n.siteId !== currentSiteId)
        const otherConnections = connections.filter(c => {
          const startNode = nodes.find(n => n.id === c.startNodeId)
          const endNode = nodes.find(n => n.id === c.endNodeId)
          return startNode?.siteId !== currentSiteId || endNode?.siteId !== currentSiteId
        })
        
        const idMap = new Map<string, string>()
        const newNodes = blueprint.nodes.map(n => {
          const newId = crypto.randomUUID()
          idMap.set(n.id, newId)
          return { ...n, id: newId, siteId: currentSiteId }
        })
        
        newNodes.forEach(n => { if (n.parentRackId) n.parentRackId = idMap.get(n.parentRackId) || n.parentRackId })
        const newConnections = blueprint.connections.map(c => ({
          ...c,
          id: crypto.randomUUID(),
          startNodeId: idMap.get(c.startNodeId) || c.startNodeId,
          endNodeId: idMap.get(c.endNodeId) || c.endNodeId
        }))
        
        set({
          nodes: [...otherNodes, ...newNodes],
          connections: [...otherConnections, ...newConnections],
          previewBlueprintId: null
        })
      },

      verifyService: (nodeId, type) => {
        const node = get().nodes.find(n => n.id === nodeId)
        if (!node) return false
        
        const siteState = get().terminalStates[node.siteId]
        if (!siteState) return false

        const allLogs = siteState.sessions.flatMap(s => s.panes.flatMap(p => p.history))
        const hasInstall = allLogs.some(cmd => cmd.includes(`apt install`) && cmd.includes(type.toLowerCase()))
        const hasStart = allLogs.some(cmd => cmd.includes(`systemctl start`) && cmd.includes(type.toLowerCase()))
        
        const isPatched = get().connections.some(c => c.startNodeId === nodeId || c.endNodeId === nodeId)
        const isValid = hasInstall && hasStart && isPatched
        
        if (isValid && !node.services.some(s => s.type === type)) {
          get().updateNode(nodeId, { 
            services: [...node.services, { id: `svc-${Math.random()}`, type, status: 'running', port: 0 }] 
          })
        }
        return isValid
      },

      getServiceStatus: (type) => {
        const hasActive = get().nodes.some(n => n.services.some(s => s.type === type && s.status === 'running'))
        return hasActive ? 'green' : 'red'
      },

      patchConnection: (sNodeId, sPortId, tNodeId, tPortId) => {
        const { nodes, sites } = get()
        const sNode = nodes.find(n => n.id === sNodeId)
        const tNode = nodes.find(n => n.id === tNodeId)
        if (!sNode || !tNode) return

        const sSite = sites.find(s => s.id === sNode.siteId)
        const tSite = sites.find(s => s.id === tNode.siteId)
        
        const latency = (sSite && tSite) ? calculateGeoLatency(sSite, tSite) : 0.1

        const id = `conn-${Math.random().toString(36).substr(2, 9)}`
        const newConn: Connection = {
          id,
          startNodeId: sNodeId,
          startPortId: sPortId,
          endNodeId: tNodeId,
          endPortId: tPortId,
          bandwidthGbps: 100,
          throughputGbps: 0,
          latencyMs: latency,
          status: 'active',
          type: sNode.ports.find(p => p.id === sPortId)?.type
        }
        set(state => ({ connections: [...state.connections, newConn] }))
        useMissionStore.getState().completeObjective('m2', 'm2_obj1')
      },

      setPreviewBlueprint: (id) => set({ previewBlueprintId: id }),
      exportToTerraform: (siteId) => {
        const { nodes } = get()
        const siteNodes = nodes.filter(n => n.siteId === siteId)
        let hcl = `# Infrastructure-Tycoon: Auto-Generated Terraform HCL\n# Region: ${siteId}\n\n`
        siteNodes.filter(n => n.type !== 'rack' && n.type !== 'cooling').forEach(n => {
          const safeName = n.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
          hcl += `resource "it_node" "${safeName}_${n.id.slice(0, 4)}" {\n  name = "${n.name}"\n  hardware_key = "${n.catalogKey}"\n  region = "${siteId}"\n  compliance = "standard"\n}\n\n`
        })
        return hcl
      },
      runComplianceCheck: (siteId) => {
        const { nodes, connections } = get()
        const siteNodes = nodes.filter(n => n.siteId === siteId)
        const warnings: { type: 'error' | 'warning'; message: string }[] = []
        if (siteNodes.filter(n => n.type === 'network').length === 1) warnings.push({ type: 'error', message: 'SPOF DETECTED: Single point of failure on site network router.' })
        siteNodes.filter(n => n.type === 'storage').forEach(s => {
          const hasBackup = connections.some(c => {
            const startNode = nodes.find(n => n.id === c.startNodeId)
            const endNode = nodes.find(n => n.id === c.endNodeId)
            return (c.startNodeId === s.id && endNode?.type === 'backup') || (c.endNodeId === s.id && startNode?.type === 'backup')
          })
          if (!hasBackup) warnings.push({ type: 'warning', message: `NON-COMPLIANT: Storage [${s.name}] has no replication/backup link.` })
        })
        siteNodes.filter(n => n.type === 'rack').forEach(r => { if ((r.currentPowerKW || 0) > (r.maxPowerKW || 0) * 0.9) warnings.push({ type: 'warning', message: `CRITICAL LOAD: Rack [${r.name}] is at >90% power capacity.` }) })
        return warnings
      },

      ping: (sourceId, targetIp) => {
        const { nodes, checkNetworkPath } = get()
        const targetNode = nodes.find(n => n.managementIP === targetIp || n.ports.some(p => p.ip === targetIp))
        
        if (!targetNode) return { success: false, message: `PING ${targetIp}: Host unreachable (No route to host).` }
        
        const sourceNodeId = sourceId === 'bastion' ? nodes.find(n => n.type === 'compute')?.id : sourceId
        if (!sourceNodeId) return { success: false, message: `PING ${targetIp}: Source identity error.` }

        const hasPath = checkNetworkPath(sourceNodeId, targetNode.id)

        if (!hasPath) return { success: false, message: `PING ${targetIp}: Request timed out (No route to host).` }
        
        if (targetNode.systemState !== 'running') return { success: false, message: `PING ${targetIp}: Host is DOWN.` }

        return { success: true, message: `64 bytes from ${targetIp}: icmp_seq=1 ttl=64 time=${Math.floor(Math.random() * 5) + 1}ms` }
      },

      // v1.5 Orchestration Actions
      addDnsRecord: (record) => set(state => ({
        dnsRecords: [...state.dnsRecords, { ...record, id: crypto.randomUUID() }]
      })),
      
      removeDnsRecord: (id) => set(state => ({
        dnsRecords: state.dnsRecords.filter(r => r.id !== id)
      })),
      
      autoPatchRack: (rackId) => {
        const { nodes, connections, patchConnection } = get()
        const rackNodes = nodes.filter(n => n.parentRackId === rackId && n.type !== 'network')
        const siteSwitches = nodes.filter(n => n.siteId === get().currentSiteId && n.type === 'network')
        
        if (siteSwitches.length === 0) {
          get().pushAlert('warning', `Auto-Patch failed: No switches found on current site.`)
          return
        }
        
        const primarySwitch = siteSwitches[0]
        let patches = 0
        
        rackNodes.forEach(node => {
          const hasConnection = connections.some(c => c.startNodeId === node.id || c.endNodeId === node.id)
          if (!hasConnection) {
            const nodePort = node.ports.find(p => p.type === 'network')
            const switchPort = primarySwitch.ports.find(p => p.type === 'network' && !connections.some(c => c.startPortId === p.id || c.endPortId === p.id))
            
            if (nodePort && switchPort) {
              patchConnection(node.id, nodePort.id, primarySwitch.id, switchPort.id)
              patches++
            }
          }
        })
        
        get().pushAlert('info', `Auto-Patch complete: ${patches} logical links established for Rack [${rackId}].`)
      },
      
      syncNtp: (nodeId) => set(state => {
        const existing = state.ntpSyncStatus.find(s => s.nodeId === nodeId)
        const newSync = { nodeId, stratum: 2, offsetMs: Math.random() * 0.5, status: 'synced' as const }
        if (existing) {
          return { ntpSyncStatus: state.ntpSyncStatus.map(s => s.nodeId === nodeId ? newSync : s) }
        }
        return { ntpSyncStatus: [...state.ntpSyncStatus, newSync] }
      }),

      advanceProvisioningState: (id: string) => {
        const { nodes, connections, updateNode, pushAlert } = get()
        const node = nodes.find(n => n.id === id)
        if (!node) return

        let nextState = node.provisioningState
        let error = ''

        switch (node.provisioningState) {
          case 'unboxed':
            if (node.parentRackId) nextState = 'racked'
            else error = 'Hardware must be installed in a rack first.'
            break
          case 'racked':
            const isPatched = connections.some(c => c.startNodeId === id || c.endNodeId === id)
            if (isPatched) nextState = 'patched'
            else error = 'Hardware requires physical network patching (Ethernet/FC).'
            break
          case 'patched':
            nextState = 'bootstrapped'
            break
          case 'bootstrapped':
            if (node.systemState === 'running') nextState = 'provisioned'
            else error = 'System must be powered on and operational for final provisioning.'
            break
        }

        if (error) {
          pushAlert('warning', `Provisioning Error: ${error}`, id)
        } else if (nextState !== node.provisioningState) {
          updateNode(id, { provisioningState: nextState })
          pushAlert('info', `Asset ${node.hostname || node.id.slice(0,6)} advanced to ${nextState.toUpperCase()}.`, id)
        }
      },

      powerOnNode: (nodeId) => {
        const { nodes, updateNode, pushAlert } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node || node.systemState !== 'off') return

        if (node.provisioningState === 'unboxed' || node.provisioningState === 'racked') {
          pushAlert('critical', `BOOT FAILURE: Node ${node.id.slice(0,6)} lacks physical connectivity/patching.`, nodeId)
          return
        }

        updateNode(nodeId, { systemState: 'booting', bootProgress: 0 })
        pushAlert('info', `POWER_ON: Asset ${node.hostname || node.id.slice(0,8)} initializing POST sequence.`, nodeId)

        const interval = setInterval(() => {
          const latestNode = get().nodes.find(n => n.id === nodeId)
          if (!latestNode || latestNode.systemState !== 'booting') {
            clearInterval(interval)
            return
          }

          const nextProgress = latestNode.bootProgress + Math.floor(Math.random() * 15) + 5
          if (nextProgress >= 100) {
            updateNode(nodeId, { systemState: 'running', bootProgress: 100 })
            pushAlert('info', `BOOT_SUCCESS: ${latestNode.hostname || latestNode.id.slice(0,8)} is operational.`, nodeId)
            clearInterval(interval)
          } else {
            updateNode(nodeId, { bootProgress: nextProgress })
          }
        }, 1000)
      },

      setNodeHostname: (nodeId, name) => set(state => ({
        nodes: state.nodes.map(n => n.id === nodeId ? { ...n, hostname: name } : n)
      })),

      assignNetworkDetails: () => {
        const { nodes, getServiceStatus, pushAlert, checkNetworkPath, availableIPPool } = get()
        const isDhcpActive = getServiceStatus('DHCP') === 'green'
        const dhcpServers = nodes.filter(n => n.services?.some(s => s.type === 'DHCP' && s.status === 'running'))
        
        if (!isDhcpActive || dhcpServers.length === 0) return

        const pool = [...availableIPPool]
        const updatedNodes = [...nodes]
        let assignedCount = 0

        updatedNodes.forEach((node, idx) => {
          if (node.type === 'rack' || node.type === 'cooling') return
          if (node.managementIP) return 
          if (node.provisioningState !== 'patched' && node.provisioningState !== 'bootstrapped') return

          const hasPathToDhcp = dhcpServers.some(srv => checkNetworkPath(node.id, srv.id))

          if (hasPathToDhcp && pool.length > 0) {
            const ip = pool.shift()!
            updatedNodes[idx] = {
              ...node,
              managementIP: ip,
              provisioningState: 'bootstrapped',
              isConfigured: true
            }
            assignedCount++
            
            set(state => ({
              dhcpLeases: [...state.dhcpLeases, { id: crypto.randomUUID(), nodeId: node.id, ip, expires: Date.now() + 86400000 }],
              availableIPPool: pool
            }))
          }
        })

        if (assignedCount > 0) {
          set({ nodes: updatedNodes })
          pushAlert('info', `DHCP ORCHESTRATOR: Provisioned ${assignedCount} nodes via pool. Fabric integrity verified.`)
        }
      },

      checkNetworkPath: (startId, endId) => {
        const { connections, nodes } = get()
        const queue = [startId]
        const visited = new Set([startId])
        
        while (queue.length > 0) {
          const current = queue.shift()!
          if (current === endId) return true
          
          const neighbors = connections
            .filter(c => {
              if (c.status !== 'active') return false
              // Senior Principal Fix: Only allow 'network' port traffic
              const sPort = nodes.find(n => n.id === c.startNodeId)?.ports.find(p => p.id === c.startPortId)
              return sPort?.type === 'network' && (c.startNodeId === current || c.endNodeId === current)
            })
            .map(c => c.startNodeId === current ? c.endNodeId : c.startNodeId)
          
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor)
              queue.push(neighbor)
            }
          }
        }
        return false
      },

      generateFinalReport: () => {
        const { nodes, resilienceIndex, capacityUnits } = get()
        const nodeCount = nodes.filter(n => n.type !== 'rack').length
        const healthyCount = nodes.filter(n => n.healthStatus === 'healthy').length
        const healthScore = nodeCount > 0 ? (healthyCount / nodeCount) * 100 : 100
        
        const finalScore = (healthScore + resilienceIndex + Math.min(100, capacityUnits / 10)) / 3
        const grade = finalScore > 90 ? 'S' : finalScore > 80 ? 'A' : finalScore > 70 ? 'B' : 'C'
        return {
          score: finalScore,
          grade,
          breakdown: {
            availability: healthScore,
            resilience: resilienceIndex,
            capacity: capacityUnits
          }
        }
      },
      validateReplication: (linkId: string) => {
        // SDDC Logic: Replication is valid if source node is healthy and has logical network identity
        const node = get().nodes.find(n => n.id === linkId)
        return !!(node && node.healthStatus === 'healthy' && node.provisioningState === 'bootstrapped')
      },

      checkAllCompliance: () => {
        // Implementation for global compliance audit
      },
      setCloudBursting: (active: boolean) => set({ cloudBurstingActive: active }),

      updateTerminalLogs: (sessionId: string, paneId: string, logs: string[]) => set(state => {
        const siteId = state.currentSiteId
        const siteState = state.terminalStates[siteId]
        if (!siteState) return state
        
        return {
          terminalStates: {
            ...state.terminalStates,
            [siteId]: {
              ...siteState,
              sessions: siteState.sessions.map(s => s.id === sessionId ? {
                ...s,
                panes: s.panes.map(p => p.id === paneId ? { ...p, logs: [...p.logs, ...logs] } : p)
              } : s)
            }
          }
        }
      }),

      fixState: () => set(state => {
        const requiredSites = [
          { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } },
          { id: 'site-2', name: 'DR-Site', isDisaster: false, region: 'US-East', energySource: 'Grid', geoCoords: { lat: 40.71, lng: -74.00 } }
        ] as Site[]
        const updatedSites = [...state.sites]
        requiredSites.forEach(rs => {
          if (!updatedSites.find(s => s.id === rs.id)) {
            updatedSites.push(rs)
          }
        })
        return { sites: updatedSites }
      }),

      updateSite: (id: string, updates: Partial<Site>) => {
        set(state => ({
          sites: state.sites.map(s => s.id === id ? { ...s, ...updates } : s)
        }))
      },

      resetState: () => {
        set({
          nodes: [],
          connections: [],
          cloudLinks: [],
          alerts: [],
          auditLogs: [],
          deploymentQueue: [],
          simulationCycle: 0,
          dnsRecords: [],
          dhcpLeases: [],
          ntpSyncStatus: [],
          postMortems: [],
          operationalBudget: 1000000,
          capacityUnits: 0,
          terminalStates: INITIAL_TERMINAL_STATE,
          isAutoPilot: false,
          isGlobalMapOpen: false,
          isChaosMode: false,
          assistantTargetId: null
        })
      },

      deployApplication: (appId, nodeId) => {
        const { nodes, pushAlert } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        const id = `app-${Math.random().toString(36).substr(2, 9)}`
        const newApp: ApplicationDeployment = {
          id,
          appId,
          nodeId,
          status: 'deploying',
          progress: 0
        }

        set(state => ({ applications: [...state.applications, newApp] }))
        pushAlert('info', `Deployment started: ${appId} on ${node.name}`, nodeId)
      },

      removeApplication: (id) => set(state => ({
        applications: state.applications.filter(a => a.id !== id)
      })),

      acceptContract: (blueprintId) => {
        const { reputation, pushAlert } = get()
        const blueprint = CONTRACT_CATALOG[blueprintId]
        if (!blueprint) return

        if (reputation < blueprint.minReputation) {
          pushAlert('warning', `Reputation too low for ${blueprint.name}. Required: ${blueprint.minReputation}`)
          return
        }

        const newContract: ActiveContract = {
          id: `con-${Math.random().toString(36).substr(2, 9)}`,
          blueprintId,
          startDate: get().simulationCycle,
          uptimeTicks: 0,
          totalTicks: 0,
          currentStatus: 'healthy',
          accumulatedPenalty: 0
        }

        set(state => ({ activeContracts: [...state.activeContracts, newContract] }))
        audioManager.playEffect('success')
        pushAlert('info', `CONTRACT SIGNED: ${blueprint.name} is now active.`)
      },

      cancelContract: (id) => {
        set(state => ({
          activeContracts: state.activeContracts.filter(c => c.id !== id)
        }))
        get().pushAlert('info', 'Contract cancelled by operator.')
      },

      processTick: () => {
        // 0. Request Worker Tick (Asynchronous)
        simWorkerManager.syncInput(get().nodes, get().applications)
        simWorkerManager.requestTick()
        
        const { nodes, applications, activeContracts, simulationCycle, balance, reputation } = get()

        // Remove old sync-back logic (now handled by handleWorkerOutput callback)
        
        // 2. SLA & Contract Management
        const isMonthEnd = simulationCycle % 30 === 0 && simulationCycle > 0
        let monthlyRevenue = 0
        let monthlyPenalty = 0

        const updatedContracts = activeContracts.map(contract => {
          const blueprint = CONTRACT_CATALOG[contract.blueprintId]
          if (!blueprint) return contract

          // Check requirements
          let isHealthy = true
          blueprint.requirements.forEach(req => {
            const runningApps = applications.filter(a => a.appId === req.appId && a.status === 'running')
            if (runningApps.length < req.count) isHealthy = false
          })

          const newAccumulatedPenalty = isHealthy 
            ? contract.accumulatedPenalty 
            : contract.accumulatedPenalty + blueprint.penaltyPerTick

          if (isMonthEnd) {
            monthlyRevenue += blueprint.monthlyMRR
            monthlyPenalty += newAccumulatedPenalty
          }

          return {
            ...contract,
            totalTicks: contract.totalTicks + 1,
            uptimeTicks: isHealthy ? contract.uptimeTicks + 1 : contract.uptimeTicks,
            currentStatus: isHealthy ? 'healthy' as const : 'violating' as const,
            accumulatedPenalty: isMonthEnd ? 0 : newAccumulatedPenalty
          }
        })

        // 3. Operational Expenses
        const totalPowerKW = nodes.reduce((sum, n) => sum + (n.wattage || 0), 0) / 1000
        const powerCost = totalPowerKW * 0.12 // $0.12 per kWh equivalent per tick
        const rackRent = nodes.filter(n => n.type === 'rack').length * 50 // $50 per rack per tick

        const maintenanceCost = nodes.reduce((sum, n) => {
          if (n.type === 'rack') return sum
          const base = 10 // $10 base maintenance per node
          const stressMultiplier = n.isThrottled ? 2.5 : 1.0
          const ageMultiplier = 1 + (n.degradation / 100)
          return sum + (base * stressMultiplier * ageMultiplier)
        }, 0)

        // Hybrid Cloud Expenses
        const cloudCost = get().cloudBurstingActive ? (get().activeCloudInstances * 5) : 0
        const egressCost = get().cloudEgressGB * 0.1 // $0.10 per GB

        const totalExpenses = powerCost + rackRent + cloudCost + egressCost + maintenanceCost
        let newBalance = balance - totalExpenses

        if (isMonthEnd) {
          const netPayout = monthlyRevenue - monthlyPenalty
          newBalance += netPayout
          
          // Reputation adjustment
          const avgUptime = updatedContracts.length > 0 
            ? updatedContracts.reduce((sum, c) => sum + (c.uptimeTicks / c.totalTicks), 0) / updatedContracts.length 
            : 1.0
          
          const repChange = avgUptime > 0.99 ? 2 : avgUptime < 0.95 ? -5 : 0
          set({ reputation: Math.max(0, Math.min(100, reputation + repChange)) })

          get().pushAlert('info', `MONTHLY PAYOUT: $${netPayout.toLocaleString()} (Rev: $${monthlyRevenue}, Penalties: -$${monthlyPenalty})`)
        }

        // 4. State Update
        set({ 
          activeContracts: updatedContracts,
          balance: newBalance,
          simulationCycle: simulationCycle + 1
        })

        // Recalculate Facilities
        recalculateRoomStats()
        nodes.filter(n => n.type === 'rack').forEach(r => calculateRackPower(r.id))
      },

      visualizePath: (startId, endId) => {
        const { connections } = get()
        if (startId === endId) return

        // BFS to find shortest path
        const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startId, path: [] }]
        const visited = new Set<string>([startId])
        
        while (queue.length > 0) {
          const { nodeId, path } = queue.shift()!
          
          if (nodeId === endId) {
            set(state => ({
              connections: state.connections.map(c => 
                path.includes(c.id) ? { ...c, highlightTime: Date.now() + 5000 } : c
              )
            }))
            return
          }

          connections.forEach(c => {
            if (c.status === 'blocked') return
            let nextId: string | null = null
            if (c.startNodeId === nodeId) nextId = c.endNodeId
            else if (c.endNodeId === nodeId) nextId = c.startNodeId

            if (nextId && !visited.has(nextId)) {
              visited.add(nextId)
              queue.push({ nodeId: nextId, path: [...path, c.id] })
            }
          })
        }
        get().pushAlert('warning', 'Network unreachable: No valid path found between selected nodes.')
      },

      saveGame: (slotId) => {
        const state = get()
        const meta: SaveMetadata = {
          id: slotId,
          timestamp: Date.now(),
          siteName: state.sites.find(s => s.id === state.currentSiteId)?.name || 'Unknown',
          nodeCount: state.nodes.length
        }
        
        const saveData = JSON.stringify({ state, meta })
        localStorage.setItem(`infra-tycoon-save-${slotId}`, saveData)
        
        // Update list of saves in a special meta key
        const existingMeta = JSON.parse(localStorage.getItem('infra-tycoon-saves-meta') || '[]') as SaveMetadata[]
        const newMeta = [meta, ...existingMeta.filter(m => m.id !== slotId)].slice(0, 10)
        localStorage.setItem('infra-tycoon-saves-meta', JSON.stringify(newMeta))
        
        get().pushAlert('info', `Game saved to Slot ${slotId}`)
      },

      loadGame: (slotId) => {
        const saveData = localStorage.getItem(`infra-tycoon-save-${slotId}`)
        if (!saveData) {
          get().pushAlert('critical', `Failed to load Slot ${slotId}: No data found.`)
          return
        }
        
        try {
          const { state } = JSON.parse(saveData)
          set(state)
          get().pushAlert('info', `Game loaded from Slot ${slotId}`)
          // Force a small delay then fix state
          setTimeout(() => get().fixState(), 100)
        } catch {
          get().pushAlert('critical', `Failed to load Slot ${slotId}: Data corruption.`)
        }
      },

      getAvailableSaves: () => {
        return JSON.parse(localStorage.getItem('infra-tycoon-saves-meta') || '[]') as SaveMetadata[]
      },

      getSimulationTelemetry: () => {
         // Telemetry is now updated asynchronously via callback
         return (get() as any)._lastTelemetry || { tickDurationMs: 0, entityCount: 0, lastTickTime: Date.now() }
      },

      initializeSimulation: () => {
        console.log('[[Store]] Initializing Simulation Worker integration...')
        simWorkerManager.onOutput((payload) => get().handleWorkerOutput(payload))
        simWorkerManager.onTelemetry((telemetry) => {
          set({ _lastTelemetry: telemetry } as any)
        })
        simWorkerManager.init(get().nodes, get().applications)
      },

      handleWorkerOutput: (payload: SimSyncOutputPayload) => {
        const { nodes, applications } = get()
        
        const updatedNodes = nodes.map(node => {
          const workerData = payload.nodes.find(n => n.id === node.id)
          if (workerData) {
            return {
              ...node,
              temperature: workerData.temperature,
              isThrottled: workerData.isThrottled,
              currentPowerKW: workerData.currentPowerKW,
              bootProgress: workerData.bootProgress,
              systemState: workerData.systemState as any
            }
          }
          return node
        })

        const updatedApps = applications.map(app => {
          const workerApp = payload.applications.find(a => a.id === app.id)
          if (workerApp) {
            return {
              ...app,
              status: workerApp.status as any,
              progress: workerApp.progress
            }
          }
          return app
        })

        set({ nodes: updatedNodes, applications: updatedApps })
      }
    }),
    {
      name: 'infra-tycoon-state',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (rehydratedState) => {
        if (rehydratedState) {
          const s = rehydratedState as InfraState
          
          // v1.3 Migration: Ensure terminal states have panes and aliases
          const updatedTerminalStates = { ...s.terminalStates }
          let needsMigration = false
          
          Object.keys(updatedTerminalStates).forEach(siteId => {
            const state = updatedTerminalStates[siteId]
            if (state && (!state.sessions?.[0]?.panes || !state.aliases)) {
              needsMigration = true
              updatedTerminalStates[siteId] = {
                ...state,
                aliases: state.aliases || { 'll': 'ls -la' },
                envVars: state.envVars || { 'USER': 'admin' },
                storedFiles: state.storedFiles || { '/etc/motd': 'System Upgraded to v1.3' },
                sessions: (state.sessions || []).map(sess => {
                  if (sess.panes) return sess
                  const pId = `p-${Math.random().toString(36).substr(2, 9)}`
                  return {
                    ...sess,
                    panes: [{ 
                      id: pId, 
                      logs: (sess as { logs?: string[] }).logs || ['Session Migrated to v1.3.'],
                      history: (sess as { history?: string[] }).history || [],
                      cwd: (sess as { cwd?: string }).cwd || '/',
                      context: (sess as { context?: unknown }).context || { mode: 'global', targetId: null }
                    }],
                    activePaneId: pId,
                    layout: 'single'
                  } as TerminalSession
                })
              }
            }
          })

          if (needsMigration) {
            useInfraStore.setState({ terminalStates: updatedTerminalStates })
          }

          const currentSites = s.sites || []
          if (currentSites.some(x => !x.region || !x.geoCoords) || currentSites.length === 0) {
            useInfraStore.setState({
              sites: [
                { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } },
                { id: 'site-2', name: 'DR-Site', isDisaster: false, region: 'US-East', energySource: 'Grid', geoCoords: { lat: 39.04, lng: -77.49 } }
              ] as Site[],
              currentSiteId: s.currentSiteId || 'site-1'
            })
          }
        }
      }
    }
  )
)