import { Vector3 } from 'three'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  HARDWARE_CATALOG,
  type HardwareCatalogKey,
  type PortType,
} from '../physics/hardwareLibrary'
import { TECHNICAL_MANUALS } from '../physics/Manuals'
import { findFirstEmptySlot } from '../physics/snapping'
import { calculateRackPower, recalculateRoomStats } from '../physics/powerEngine'
import type { TerminalPane, TerminalSession } from './terminalTypes'

export type InfraNodeType = 'rack' | 'compute' | 'storage' | 'network' | 'backup' | 'cooling' | 'load_balancer'
export type RackStatus = 'online' | 'power_overload'
export type HealthStatus = 'healthy' | 'degraded' | 'critical'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type BackupStatus = 'protected' | 'unprotected' | 'backing_up'
export type DataCategory = 'Public' | 'Internal' | 'PII'

export type InfraAlert = {
  id: string
  timestamp: number
  severity: AlertSeverity
  message: string
  isAcknowledged: boolean
  nodeId?: string
}

export type AuditLog = {
  id: string
  timestamp: number
  type: 'SovereigntyViolation' | 'ComplianceCheck' | 'LifecycleEvent'
  message: string
  sourceNodeId: string
  targetNodeId: string
  status: 'Blocked' | 'Allowed' | 'Info'
}

export type Site = {
  id: string
  name: string
  isDisaster: boolean
  region: string
  energySource: 'Renewable' | 'Grid'
  geoCoords: { lat: number; lng: number }
}

export type HardwarePort = {
  id: string
  type: PortType
  label: string
  connectedTo: null | string
  status: 'up' | 'down'
  ip?: string
  mask?: string
}

export type Tenant = {
  id: string
  name: string
  color: string
  budget: number
}

export type ServiceType = 'web' | 'storage' | 'backup' | 'DHCP' | 'DNS' | 'NTP'
export type ServiceStatus = 'running' | 'stopped' | 'degraded'

export type NodeService = {
  id: string
  type: ServiceType
  status: ServiceStatus
  port: number
}

export type Gig = {
  id: string
  name: string
  reward: number
  requirements?: { type: InfraNodeType; count: number }[]
  serviceRequirements: { type: ServiceType; count: number }[]
}

export type DnsRecord = { id: string; hostname: string; ip: string; ttl: number }
export type DhcpLease = { id: string; nodeId: string; ip: string; expires: number }
export type NtpSyncStatus = { nodeId: string; stratum: number; offsetMs: number; status: 'synced' | 'unsynced' }



export interface InfraNode {
  id: string
  type: InfraNodeType
  siteId: string
  position: Vector3
  name: string
  uHeight: number
  wattage: number
  btuOutput: number
  parentRackId?: string
  slotIndex?: number
  catalogKey?: HardwareCatalogKey
  maxPowerKW?: number
  currentPowerKW?: number
  status?: RackStatus
  healthStatus?: HealthStatus
  backupStatus?: BackupStatus
  totalStorageTB?: number
  usedStorageTB?: number
  
  // v1.6 Bootstrap Workflow
  isPoweredOn?: boolean
  hostname?: string
  isConfigured?: boolean
  managementIP?: string
  vlan?: number
  macAddress?: string
  provisioningState: 'unboxed' | 'racked' | 'patched' | 'bootstrapped'
  
  ports: HardwarePort[]
  services: NodeService[]
  assetTag?: string
  serialNumber?: string
  tenantId?: string
  qosEnabled?: boolean
  dataCategory?: DataCategory
  // Lifecycle & Aging
  installDate: number // Simulation cycle index
  degradation: number // 0-100
  isRefreshing?: boolean
}

export interface CloudLink {
  id: string
  nodeId: string
  tieredTB: number
}

export interface Connection {
  id: string
  startNodeId: string
  startPortId: string
  endNodeId: string
  endPortId: string
  bandwidthGbps: number
  throughputGbps: number
  latencyMs: number
  isBlockedByCompliance?: boolean
  status?: 'active' | 'blocked'
  syncProgress?: number
}

export interface PostMortem {
  id: string
  incidentNumber: number
  timestamp: number
  nodeName: string
  nodeId: string
  rca: string
  mitigation: string
  impact: string
}

export interface Blueprint {
  id: string
  name: string
  nodes: InfraNode[]
  connections: Connection[]
  createdAt: number
}

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
  // Day 29 Metrics
  simulationCycle: number
  dnsRecords: DnsRecord[]
  dhcpLeases: DhcpLease[]
  availableIPPool: string[]
  ntpSyncStatus: { nodeId: string; lastSync: number }[]
  networkUptime: number
  postMortems: PostMortem[]
  
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
  
  // Day 5: Procurement & Thermal
  deploymentQueue: HardwareCatalogKey[]
  isHeatMapVisible: boolean
  toggleHeatMap: () => void
  
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
  generateFinalReport: () => { score: number, grade: string, breakdown: any }
  
  // Terminal Actions
  updateTerminalLayout: (layout: Partial<{ width: number; height: number; x: number; y: number; isMaximized: boolean }>) => void
  addTerminalSession: (title?: string) => void
  closeTerminalSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  splitTerminalPane: (direction: 'vertical' | 'horizontal') => void
  setActivePane: (paneId: string) => void
  closeTerminalPane: (paneId: string) => void
  setTerminalAlias: (name: string, command: string) => void
  setTerminalEnvVar: (name: string, value: string) => void
  writeTerminalFile: (path: string, content: string) => void
  
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

function createPortsForCatalog(nodeId: string, key: HardwareCatalogKey): HardwarePort[] {
  const { portLayout } = HARDWARE_CATALOG[key]
  return portLayout.flatMap((segment) =>
    Array.from({ length: segment.count }, (_, idx) => ({
      id: `${nodeId}-${segment.type}-${idx + 1}`,
      type: segment.type,
      label: `${segment.labelPrefix}${idx + 1}`,
      connectedTo: null,
      status: 'down',
      ip: undefined,
      mask: undefined
    }))
  )
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
        { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } }
      ],
      currentSiteId: 'site-1',
      placementMode: false,
      pendingRackType: null,
      alerts: [],
      auditLogs: [],
      isNetworkManagerOpen: false,
      networkLoad: 0.1,
      resilienceIndex: 100,
      postMortems: [],
      incidentCounter: 400,
      isGlobalMapOpen: false,
      carbonFootprintKg: 0,
      tenants: [],
      previewBlueprintId: null,
      blueprints: [],
      
      // v1.5 Orchestration State
      dnsRecords: [],
      dhcpLeases: [],
      availableIPPool: Array.from({ length: 154 }, (_, i) => `10.0.0.${101 + i}`), // 101-254
      ntpSyncStatus: [],
      networkUptime: 100,

      simulationCycle: 0,
      totalEWasteKG: 0,
      refreshCount: 0,
      repairCount: 0,
      isAutoPilot: false,
      terminalStates: {
        'site-1': { 
          sessions: [{ 
            id: 's1-1', 
            title: 'Primary Bastion', 
            panes: [{ id: 'p1-1', logs: ['Enterprise Console v1.6 Ready.'], history: [], cwd: '/', context: { mode: 'global', targetId: null } }],
            activePaneId: 'p1-1',
            layout: 'single'
          }],
          activeSessionId: 's1-1',
          layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
          aliases: { 'll': 'ls -la', 'netstat': 'show ip int brief' },
          envVars: { 'DOMAIN': 'infra.local', 'USER': 'admin' },
          storedFiles: { '/etc/motd': 'Welcome to Global Infrastructure Management v1.6\nSecurity Authorized Personnel Only.' }
        }
      },
      deploymentQueue: [],
      isHeatMapVisible: false,
      simulationCycle: 0,
      dnsRecords: [],
      dhcpLeases: [],
      availableIPPool: Array.from({ length: 154 }, (_, i) => `10.0.0.${101 + i}`),
      ntpSyncStatus: [],
      networkUptime: 100,
      auditLogs: [],
      postMortems: [],
      incidentCounter: 0,


      setNetworkLoad: (load) => set({ networkLoad: load }),
      setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
      setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
      setMousePosition: (pos) => set({ mousePosition: pos }),
      toggleHeatMap: () => set(state => ({ isHeatMapVisible: !state.isHeatMapVisible })),

      pushAlert: (severity, message, nodeId) => {
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
              entropyLevel: 100, 
              healthStatus: 'critical', 
              usedStorageTB: 0, 
              backupStatus: 'unprotected' 
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

      setNetworkLoad: (load) => set({ networkLoad: load }),
      setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
      setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
      setMousePosition: (pos) => set({ mousePosition: pos }),
      acknowledgeAllAlerts: () => set(state => ({
        alerts: state.alerts.map(a => ({ ...a, isAcknowledged: true }))
      })),
      processAutoBackups: () => {},

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
          
          const weight = node.uHeight * 15 // Roughly 15kg per U
          set(state => ({ 
            totalEWasteKG: state.totalEWasteKG + weight, 
            refreshCount: state.refreshCount + 1,
            auditLogs: [{
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: 'LifecycleEvent' as const,
              message: `Refreshed hardware ${node.name}. Generated ${weight}kg E-Waste.`,
              sourceNodeId: nodeId,
              targetNodeId: nodeId,
              status: 'Info' as const
            }, ...state.auditLogs].slice(0, 50)
          }))
          pushAlert('info', `✅ REFRESH COMPLETE: ${node.name} modernized. CAPEX charge applied.`)
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
          set(state => ({ repairCount: state.repairCount + 1 }))
          pushAlert('info', `🔧 REPAIR COMPLETE: ${nodeId.slice(0,6)} component service successful.`)
        }, 1500)
      },

      installService: (nodeId, type) => {
        const { nodes, cashBalance, pushAlert, updateNode } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        if (node.services?.some(s => s.type === type)) {
          pushAlert('warning', `Service ${type.toUpperCase()} is already installed on ${node.hostname || node.name}.`)
          return
        }

        if (cashBalance < 100) {
          pushAlert('critical', 'Insufficient funds for service installation ($100 required).')
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
        set({ cashBalance: cashBalance - 100 })
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

      addTerminalSession: (title = 'New Session') => {
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
            context: { mode: 'global', targetId: null } 
          }],
          activePaneId: paneId,
          layout: 'single'
        }
        set(s => ({
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
            return { ...sess, panes: newPanes, activePaneId: newActivePaneId, layout: 'single' }
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
        
        const session = siteState.sessions.find(s => s.id === siteState.activeSessionId)
        if (!session) return
        const pane = session.panes.find(p => p.id === session.activePaneId) || session.panes[0]

        const { nodes, updateNode, alerts, writeTerminalFile, setTerminalAlias, setTerminalEnvVar, dnsRecords } = get()
        
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
        let newContext = { ...pane.context }
        let newCwd = pane.cwd
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
            output.push("[[RED]]ERROR: No Serial/OOB connection to [${targetNode.hostname || targetNode.id.slice(0,8)}].[[RESET]]")
            output.push("Verify physical Top-of-Rack patching to Management Switch.")
            get().updateTerminalLogs(id, [...pane.logs, ...output])
            return
          }
        }

        if (cmdLower === 'help') {
          output.push("--- [[GREEN]]v1.6 BOOTSTRAP KERNEL[[RESET]] ---")
          output.push("BOOTSTRAP: [[YELLOW]]poweron[[RESET]], [[YELLOW]]hostname [n][[RESET]], [[YELLOW]]ip setup [ip] [gw] [dns][[RESET]]")
          output.push("CORE: [[BLUE]]ls -la[[RESET]], [[BLUE]]cd[[RESET]], [[BLUE]]pwd[[RESET]], [[RED]]clear[[RESET]], [[BLUE]]man [topic][[RESET]]")
          output.push("NET: [[GREEN]]ping [target][[RESET]], [[GREEN]]show ip brief[[RESET]], [[GREEN]]traceroute[[RESET]]")
          output.push("ORCH: [[BLUE]]apt install[[RESET]], [[BLUE]]systemctl start[[RESET]], [[BLUE]]sync-ntp[[RESET]]")
          output.push("NAV: [[YELLOW]]scan console[[RESET]], [[YELLOW]]connect console [id][[RESET]], [[YELLOW]]exit[[RESET]]")
        } else if (cmdLower === 'clear') {
          forceClear = true
        } else if (targetNode && !targetNode.isPoweredOn && !['poweron', 'exit', 'help'].includes(cmdLower)) {
          output.push("[[RED]]SYSTEM ERROR: Node is logically powered down.[[RESET]]")
          output.push("Required: '[[YELLOW]]poweron[[RESET]]' to initialize CPU/RAM.")
        } else if (targetNode && targetNode.isPoweredOn && !targetNode.hostname && !['hostname', 'exit', 'help', 'ipmi'].includes(cmdLower)) {
          output.push("[[RED]]BOOT ERROR: Unique Hostname not set.[[RESET]]")
          output.push("Required: '[[YELLOW]]hostname [name][[RESET]]' to set node identity.")
        } else if (cmdLower === 'poweron') {
          if (newContext.mode === 'ssh' && targetNode) {
            get().powerOnNode(targetNode.id)
            output.push("[[GREEN]]Initializing Hardware Stack...[[RESET]]")
            output.push("CPU Check: OK | RAM Check: OK | Disk Check: OK")
            output.push("BIOS/UEFI Loaded. Kernel waiting for identity.")
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
        } else if (cmdLower === 'show' && args[1] === 'ip' && args[2] === 'brief') {
          output.push("Interface       IP-Address      Status                Protocol")
          output.push("---------       ----------      ------                --------")
          nodes.filter(n => n.siteId === siteId && n.type !== 'rack').forEach(n => {
            const ip = n.managementIP || 'unassigned'
            const status = n.isPoweredOn ? "[[GREEN]]up[[RESET]]" : "[[RED]]down[[RESET]]"
            output.push(`${n.hostname || n.id.slice(0,8)}`.padEnd(15) + `${ip.padEnd(15)} ${status.padEnd(21)} ${status}`)
          })
        } else if (cmdLower === 'ping') {
          const target = args[1]
          if (!target) {
            output.push("usage: ping [IP_or_Hostname]")
          } else {
            const ip = resolveHostname(target)
            const targetNode = nodes.find(n => n.managementIP === ip || n.hostname === target)
            
            if (targetNode && get().checkNetworkPath(newContext.targetId || 'bastion', targetNode.id)) {
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
            if (!node.isPoweredOn) output.push(`[[RED]]ssh: connect to host ${host} port 22: Host is down[[RESET]]`)
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
              output.push(`${n.id.slice(0, 8)} ${n.name.padEnd(20)} ${n.isPoweredOn ? '[[GREEN]]ON[[RESET]]' : '[[RED]]OFF[[RESET]]'} [[YELLOW]]PENDING[[RESET]]`)
            })
          }
        } else if (cmdLower === 'connect' && args[1] === 'console') {
          const targetId = args[2]
          const node = nodes.find(n => n.id.startsWith(targetId) && n.siteId === siteId)
          if (node) {
            newContext = { mode: 'ssh', targetId: node.id }
            output.push(`[[GREEN]]OOB Console: Serial link established to ${node.name}.[[RESET]]`)
            if (!node.isPoweredOn) output.push("[[YELLOW]]System is currently Powered Off. Use 'poweron' to start.[[RESET]]")
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
        } else if (cmdLower === 'ipmi' && args[1] === 'set-ip') {
          const ip = args[2]
          if (newContext.mode === 'ssh' && targetNode) {
            if (!ip) output.push("usage: ipmi set-ip [IP]")
            else {
              updateNode(targetNode.id, { managementIP: ip, isConfigured: true })
              output.push(`[[GREEN]]IPMI: Static IP assigned to out-of-band interface: ${ip}[[RESET]]`)
            }
          } else output.push("[[RED]]ipmi: must be connected to a node serial console.[[RESET]]")
        } else if (cmdLower === 'sync-ntp') {
          if (newContext.targetId) {
            get().syncNtp(newContext.targetId)
            output.push("[[GREEN]]NTP: Clock synchronized with Stratum-2 source. Offset: 0.12ms[[RESET]]")
          } else output.push("[[RED]]sync-ntp: must be connected to a node.[[RESET]]")
        } else if (cmdLower === 'cat') {
          const path = args[1]
          if (siteState.storedFiles[path]) output.push(...siteState.storedFiles[path].split('\n'))
          else output.push(`[[RED]]cat: ${path}: No such file[[RESET]]`)
        } else if (cmdLower === 'exit') {
          if (newContext.mode !== 'global') {
            newContext = { mode: 'global', targetId: null }
            output.push("[[YELLOW]]Console detached.[[RESET]]")
          } else setTimeout(() => get().closeTerminalPane(pane.id), 50)
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
            if (s.id !== session.id) return s
            const updatedPanes = s.panes.map(p => {
               if (p.id !== pane.id) return p
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
        const { nodes, isAutoPilot, refreshHardware, validateReplication, addReplicationLink } = get()
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
            const target = nodes.find(n => n.id !== piiNode.id && n.type === 'backup' && n.siteId === piiNode.id && validateReplication(piiNode.id, n.id))
            if (target) {
              set({ assistantTargetId: piiNode.parentRackId || piiNode.id })
              addReplicationLink(piiNode.id, piiNode.ports[0].id, target.id, target.ports[0].id)
            }
          }
        }
      },

      generateFinalReport: () => {
        const { resilienceIndex, carbonFootprintKg, refreshCount, totalEWasteKG, auditLogs } = get()
        
        const violations = auditLogs.filter(l => l.status === 'Blocked').length
        const score = Math.round(
          (resilienceIndex * 0.4) + 
          (Math.max(0, 100 - violations * 5) * 0.2) + 
          (Math.max(0, 100 - carbonFootprintKg) * 0.2) + 
          (refreshCount * 2)
        )

        let grade = 'Junior Admin'
        if (score > 90) grade = 'Grandmaster Architect'
        else if (score > 80) grade = 'Senior Infrastructure Lead'
        else if (score > 60) grade = 'Reliability Engineer'

        return {
          score,
          grade,
          breakdown: { resilienceIndex, violations, carbonFootprintKg, totalEWasteKG }
        }
      },

      setPlacementMode: (mode, type = null) => set({ placementMode: mode, pendingRackType: type }),

      addNode: (node) => {
        const { cashBalance, pushAlert, simulationCycle, currentSiteId } = get()
        
        // Deduct balance for immediate rack placement
        if (node.type === 'rack') {
          if (cashBalance < 200) {
            pushAlert('critical', 'AUTHORIZATION DENIED: Insufficient capital to anchor new rack assets.')
            return
          }
        }

        const assetTag = node.assetTag || `ACC-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const normalizedNode = {
          ...node,
          siteId: node.siteId || currentSiteId,
          assetTag,
          installDate: node.installDate ?? simulationCycle,
          degradation: node.degradation ?? 0,
          isPoweredOn: false,
          hostname: '',
          isConfigured: false,
          managementIP: '',
          macAddress: `00:50:56:${Math.floor(Math.random()*16).toString(16)}:${Math.floor(Math.random()*16).toString(16)}:${Math.floor(Math.random()*16).toString(16)}`.toUpperCase(),
          provisioningState: node.parentRackId ? 'racked' : 'unboxed',
          // Fix: Ensure ports are created safely even if catalogKey is missing (e.g. for racks)
          ports: node.ports?.length > 0 ? node.ports : (node.catalogKey ? createPortsForCatalog(node.id, node.catalogKey as HardwareCatalogKey) : []),
          services: node.services || []
        }

        set((state) => ({ 
          nodes: [...state.nodes, normalizedNode],
          cashBalance: node.type === 'rack' ? state.cashBalance - 200 : state.cashBalance
        }))

        if (normalizedNode.type === 'rack') {
          calculateRackPower(normalizedNode.id)
          pushAlert('info', `DEPLOYED: ${normalizedNode.name} anchored at site grid. -$200`)
        } else if (normalizedNode.parentRackId) {
          calculateRackPower(normalizedNode.parentRackId)
        }
        recalculateRoomStats()
      },

      placeCatalogHardware: (key, targetRackId) => {
        const { nodes, deploymentQueue, simulationCycle } = get()
        const targetRack = nodes.find(n => n.id === targetRackId)
        if (!targetRack || targetRack.type !== 'rack') return false
        
        const spec = HARDWARE_CATALOG[key]

        // Blade Logic: Blade Servers can only be placed inside a Blade Chassis
        if (spec.isBlade) {
          const hasChassis = nodes.some(n => n.parentRackId === targetRackId && HARDWARE_CATALOG[n.catalogKey as HardwareCatalogKey]?.isBladeChassis)
          if (!hasChassis) {
            get().pushAlert('warning', 'Blade Servers require a Blade Chassis for installation.')
            return false
          }
        }

        const targetNodes = nodes.filter(n => n.id === targetRackId || n.parentRackId === targetRackId)
        
        let placement;
        if (spec.isBlade) {
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
          btuOutput: spec.btuOutput !== undefined ? spec.btuOutput : spec.wattage * 3.41,
          totalStorageTB: spec.storageTB,
          usedStorageTB: spec.storageTB > 0 ? Math.floor(Math.random() * (spec.storageTB * 0.7) + (spec.storageTB * 0.3)) : 0,
          parentRackId: targetRackId,
          slotIndex: placement.slotIndex,
          healthStatus: 'healthy',
          degradation: 0,
          installDate: simulationCycle,
          ports: [],
          services: []
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
        const { patchingActive, activePatchSource, validateReplication } = get()
        if (!patchingActive) set({ patchingActive: true, activePatchSource: { nodeId, portId } })
        else {
          if (activePatchSource?.nodeId === nodeId && activePatchSource?.portId === portId) {
            set({ patchingActive: false, activePatchSource: null })
            return
          }
          
          const isBlocked = !validateReplication(activePatchSource!.nodeId, nodeId)
          
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
            syncProgress: 0
          }
          set((state) => ({
            connections: [...state.connections, newConnection],
            nodes: state.nodes.map(n => 
              (n.id === nodeId || n.id === activePatchSource!.nodeId) 
              ? { ...n, provisioningState: n.provisioningState === 'racked' ? 'patched' : n.provisioningState } 
              : n
            ),
            patchingActive: false,
            activePatchSource: null,
          }))
        }
      },

      addReplicationLink: (sourceId, sourcePortId, targetId, targetPortId) => {
        const { validateReplication } = get()
        const isBlocked = !validateReplication(sourceId, targetId)
        const newConnection: Connection = {
          id: crypto.randomUUID(),
          startNodeId: sourceId,
          startPortId: sourcePortId,
          endNodeId: targetId,
          endPortId: targetPortId,
          bandwidthGbps: 100,
          throughputGbps: 0,
          latencyMs: 1,
          isBlockedByCompliance: isBlocked,
          status: isBlocked ? 'blocked' : 'active',
          syncProgress: 0
        }
        set((state) => ({ connections: [...state.connections, newConnection] }))
      },

      removeConnection: (id) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
      })),

      removeNode: (id) => {
        const nodeToRemove = get().nodes.find(n => n.id === id)
        if (!nodeToRemove) return
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

      updateNode: (id, updates) => {
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        }))
        if (updates.dataCategory) {
          get().checkAllCompliance()
        }
      },

      addTenant: (tenant) => set(state => ({ tenants: [...state.tenants, tenant] })),
      removeTenant: (id) => set(state => ({
        tenants: state.tenants.filter(t => t.id !== id),
        nodes: state.nodes.map(n => n.tenantId === id ? { ...n, tenantId: undefined } : n)
      })),
      assignNodeToTenant: (nodeId, tenantId) => set(state => ({
        nodes: state.nodes.map(n => n.id === nodeId ? { ...n, tenantId: tenantId || undefined } : n)
      })),
      updateNodeQoS: (nodeId, enabled) => set(() => ({
        nodes: get().nodes.map(n => n.id === nodeId ? { ...n, qosEnabled: enabled } : n)
      })),

      saveSiteAsBlueprint: (name) => {
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

      applyBlueprint: (id) => {
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
        const id = `conn-${Math.random().toString(36).substr(2, 9)}`
        const newConn: Connection = {
          id,
          startNodeId: sNodeId,
          startPortId: sPortId,
          endNodeId: tNodeId,
          endPortId: tPortId,
          bandwidthGbps: 100,
          throughputGbps: 0,
          latencyMs: 0.1,
          status: 'active'
        }
        set(state => ({ connections: [...state.connections, newConn] }))
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
        
        if (!targetNode.isPoweredOn) return { success: false, message: `PING ${targetIp}: Host is DOWN.` }

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
            const nodePort = node.ports.find(p => p.type === 'RJ45' || p.type === 'SFP+')
            const switchPort = primarySwitch.ports.find(p => p.type === nodePort?.type && !connections.some(c => c.startPortId === p.id || c.endPortId === p.id))
            
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

      powerOnNode: (nodeId) => set(state => ({
        nodes: state.nodes.map(n => n.id === nodeId ? { ...n, isPoweredOn: true } : n)
      })),

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

      processTick: () => {
        const { nodes } = get()
        
        // Professional Ops Metrics: Capacity & Health
        const degradedCount = nodes.filter(n => (n.degradation ?? 0) > 50).length
        if (degradedCount > 0) {
          get().pushAlert('warning', `INFRA HEALTH: ${degradedCount} nodes are operating outside normal thermal/wear parameters.`)
        }
        
        set(state => ({ simulationCycle: state.simulationCycle + 1 }))
      },
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
                      logs: (sess as any).logs || ['Session Migrated to v1.3.'],
                      history: (sess as any).history || [],
                      cwd: (sess as any).cwd || '/',
                      context: (sess as any).context || { mode: 'global', targetId: null }
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
              ],
              currentSiteId: s.currentSiteId || 'site-1'
            })
          }
        }
      }
    }
  )
)