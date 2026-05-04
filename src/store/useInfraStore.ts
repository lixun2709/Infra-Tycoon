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

export type ServiceType = 'web' | 'storage' | 'backup'
export type ServiceStatus = 'running' | 'stopped'

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
  
  // Day 6: Advanced Terminal & Config
  isConfigured?: boolean
  managementIP?: string
  vlan?: number
  vlanConfig?: { mode: 'access' | 'trunk'; nativeVlan: number }
  volumes?: { name: string; sizeTB: number }[]
  isImmutable?: boolean
  clusterRole?: 'active' | 'standby'
  cloudTieredTB?: number
  isInfected?: boolean
  entropyLevel?: number
  failureProbability?: number
  predictedLifeRemaining?: number
  activeMigration?: { targetNodeId: string; progress: number } | null
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
  cableMode: boolean
  connectingPort: { nodeId: string; portId: string } | null
  mousePosition: Vector3 | null
  sites: Site[]
  currentSiteId: string
  placementMode: boolean
  pendingRackType: string | null
  alerts: InfraAlert[]
  auditLogs: AuditLog[]
  isNetworkManagerOpen: boolean
  networkLoad: number
  isChaosMode: boolean
  resilienceIndex: number
  postMortems: PostMortem[]
  incidentCounter: number
  isGlobalMapOpen: boolean
  carbonFootprintKg: number
  tenants: Tenant[]
  previewBlueprintId: string | null
  blueprints: Blueprint[]
  // Day 29 Metrics
  simulationCycle: number
  totalEWasteKG: number
  refreshCount: number
  repairCount: number
  // Day 30 State
  isAutoPilot: boolean
  assistantTargetId: string | null

  cashBalance: number
  lastTickProfit: number
  activeContracts: Gig[]
  
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
  shoppingCart: { key: HardwareCatalogKey; quantity: number }[]
  addToCart: (key: HardwareCatalogKey) => void
  removeFromCart: (key: HardwareCatalogKey) => void
  clearCart: () => void
  checkout: () => void
  
  setNetworkLoad: (load: number) => void
  setNetworkManagerOpen: (open: boolean) => void
  setCurrentSiteId: (siteId: string) => void
  setMousePosition: (pos: Vector3 | null) => void
  initiateFailover: () => void
  pushAlert: (severity: AlertSeverity, message: string, nodeId?: string) => void
  acknowledgeAlert: (id: string) => void
  acknowledgeAllAlerts: () => void
  simulateRandomFailure: () => void
  simulateDataCorruption: () => void
  triggerSiteDisaster: () => void
  processAutoBackups: () => void
  processCloudTiering: () => void
  performMassRollback: () => void
  processAIPredictions: () => void
  simulateStressTest: () => void
  toggleChaosMode: () => void
  processChaosLoop: () => void
  toggleGlobalMap: () => void
  processGeoRouting: () => void
  processTenancyEffect: () => void
  validateReplication: (sourceId: string, targetId: string) => boolean
  checkAllCompliance: () => void
  // Day 29 Actions
  processAging: () => void
  refreshHardware: (nodeId: string) => void
  repairHardware: (nodeId: string) => void
  installService: (nodeId: string, type: ServiceType) => void
  toggleService: (nodeId: string, serviceId: string, status: ServiceStatus) => void
  // Day 30 Actions
  processCommand: (text: string) => void
  toggleAutoPilot: () => void
  processAutoPilot: () => void
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
  
  // Career v1.1 Actions
  processTick: () => void
  acceptContract: (gig: Gig) => void
  resetCareer: () => void
  
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  handlePortClick: (nodeId: string, portId: string) => void
  addReplicationLink: (sourceId: string, sourcePortId: string, targetId: string, targetPortId: string) => void
  removeConnection: (id: string) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
  addTenant: (tenant: Tenant) => void
  removeTenant: (id: string) => void
  assignNodeToTenant: (nodeId: string, tenantId: string | null) => void
  updateNodeQoS: (nodeId: string, enabled: boolean) => void
  saveSiteAsBlueprint: (name: string) => void
  applyBlueprint: (id: string) => void
  setPreviewBlueprint: (id: string | null) => void
  exportToTerraform: (siteId: string) => string
  runComplianceCheck: (siteId: string) => { type: 'error' | 'warning'; message: string }[]
  ping: (sourceId: string, targetIp: string) => { success: boolean; message: string }
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
      cableMode: false,
      connectingPort: null,
      mousePosition: null,
      sites: [
        { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } },
        { id: 'site-2', name: 'DR-Site', isDisaster: false, region: 'US-East', energySource: 'Grid', geoCoords: { lat: 39.04, lng: -77.49 } }
      ],
      currentSiteId: 'site-1',
      placementMode: false,
      pendingRackType: null,
      alerts: [],
      auditLogs: [],
      isNetworkManagerOpen: false,
      networkLoad: 0.1,
      isChaosMode: false,
      resilienceIndex: 50,
      postMortems: [],
      incidentCounter: 400,
      isGlobalMapOpen: false,
      carbonFootprintKg: 0,
      tenants: [],
      previewBlueprintId: null,
      blueprints: [],
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
            panes: [{ id: 'p1-1', logs: ['Enterprise Console v1.3 Ready.'], history: [], cwd: '/', context: { mode: 'global', targetId: null } }],
            activePaneId: 'p1-1',
            layout: 'single'
          }],
          activeSessionId: 's1-1',
          layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
          aliases: { 'll': 'ls -la', 'netstat': 'show ip int brief' },
          envVars: { 'DOMAIN': 'infra.local', 'USER': 'admin' },
          storedFiles: { '/etc/motd': 'Welcome to Global Infrastructure Management v1.3\nSecurity Authorized Personnel Only.' }
        },
        'site-2': { 
          sessions: [{ 
            id: 's2-1', 
            title: 'DR Bastion', 
            panes: [{ id: 'p2-1', logs: ['DR Console v1.3 Ready.'], history: [], cwd: '/', context: { mode: 'global', targetId: null } }],
            activePaneId: 'p2-1',
            layout: 'single'
          }],
          activeSessionId: 's2-1',
          layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
          aliases: {},
          envVars: { 'USER': 'admin' },
          storedFiles: { '/etc/motd': 'DR Site Management Console' }
        }
      },
      assistantTargetId: null,

      cashBalance: 10000,
      lastTickProfit: 0,
      activeContracts: [],
      deploymentQueue: [],
      isHeatMapVisible: false,
      shoppingCart: [],

      addToCart: (key) => set(state => {
        const existing = state.shoppingCart.find(item => item.key === key)
        if (existing) {
          return { shoppingCart: state.shoppingCart.map(item => item.key === key ? { ...item, quantity: item.quantity + 1 } : item) }
        }
        return { shoppingCart: [...state.shoppingCart, { key, quantity: 1 }] }
      }),

      removeFromCart: (key) => set(state => {
        const existing = state.shoppingCart.find(item => item.key === key)
        if (existing && existing.quantity > 1) {
          return { shoppingCart: state.shoppingCart.map(item => item.key === key ? { ...item, quantity: item.quantity - 1 } : item) }
        }
        return { shoppingCart: state.shoppingCart.filter(item => item.key !== key) }
      }),

      clearCart: () => set({ shoppingCart: [] }),

      checkout: () => {
        const { shoppingCart, cashBalance, pushAlert } = get()
        const total = shoppingCart.reduce((sum, item) => sum + (HARDWARE_CATALOG[item.key].purchasePrice * item.quantity), 0)
        
        if (total > cashBalance) {
          pushAlert('critical', 'AUTHORIZATION DENIED: Insufficient project capital for requested manifest.')
          return
        }

        const newItems: HardwareCatalogKey[] = []
        shoppingCart.forEach(item => {
          for (let i = 0; i < item.quantity; i++) {
            newItems.push(item.key)
          }
        })

        set(state => ({
          cashBalance: state.cashBalance - total,
          deploymentQueue: [...state.deploymentQueue, ...newItems],
          shoppingCart: []
        }))
        
        pushAlert('info', `PROJECT AUTHORIZED: ${newItems.length} assets staged for deployment. -$${total.toLocaleString()}`)
      },

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

      triggerSiteDisaster: () => {
        const { nodes, currentSiteId, sites, pushAlert, updateNode } = get()
        set({ sites: sites.map(s => s.id === currentSiteId ? { ...s, isDisaster: true } : s) })
        
        let count = 0
        nodes.forEach(n => {
          if (n.siteId === currentSiteId && n.type !== 'rack' && n.type !== 'cooling' && n.backupStatus !== 'protected') {
            updateNode(n.id, { healthStatus: 'critical' })
            count++
          }
        })
        pushAlert('critical', `SITE DISASTER: Datacenter failure simulation! ${count} unprotected systems offline in ${currentSiteId}. Protected systems survived.`)
      },

      initiateFailover: () => {
        const { sites, pushAlert } = get()
        const healthySite = sites.find(s => !s.isDisaster)
        if (healthySite) {
          set({ currentSiteId: healthySite.id })
          pushAlert('info', `FAILOVER COMPLETED: Traffic routed to ${healthySite.name}.`)
        } else {
          pushAlert('critical', 'FAILOVER FAILED: No healthy sites available!')
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

      performMassRollback: () => {
        const { nodes, pushAlert } = get()
        const infectedNodes = nodes.filter(n => n.isInfected)
        if (infectedNodes.length === 0) {
          pushAlert('info', 'No infected nodes found. Systems are clean.')
          return
        }

        set(state => ({
          nodes: state.nodes.map(n => {
            if (!n.isInfected) return n
            const spec = n.catalogKey ? HARDWARE_CATALOG[n.catalogKey] : null
            return {
              ...n,
              isInfected: false,
              entropyLevel: 0,
              healthStatus: 'healthy' as HealthStatus,
              usedStorageTB: spec ? Math.floor(Math.random() * (spec.storageTB * 0.7) + (spec.storageTB * 0.3)) : (n.totalStorageTB ?? 0) * 0.5,
              backupStatus: 'protected' as BackupStatus,
            }
          })
        }))
        pushAlert('info', `🟢 MASS ROLLBACK COMPLETE: ${infectedNodes.length} node(s) restored from last clean snapshot.`)
      },

      processAIPredictions: () => {
        const { nodes, connections, networkLoad, pushAlert, totalRoomBTU } = get()
        
        const updatedNodes = nodes.map(n => {
          if (n.type === 'rack' || n.type === 'cooling') return n
          if (n.healthStatus === 'critical' || n.isInfected) return n

          const connThroughput = connections
            .filter(c => c.startNodeId === n.id || c.endNodeId === n.id)
            .reduce((sum, c) => sum + (c.throughputGbps / c.bandwidthGbps), 0)
          
          const thermalStress = Math.min(1, totalRoomBTU / 80000)
          const loadStress = networkLoad
          const storageStress = (n.totalStorageTB ?? 0) > 0 ? ((n.usedStorageTB ?? 0) / n.totalStorageTB!) : 0
          
          let prob = (n.failureProbability ?? 0)
          const stressDelta = (thermalStress * 0.3 + loadStress * 0.3 + connThroughput * 0.2 + storageStress * 0.2) * 0.02
          prob = Math.min(1, Math.max(0, prob + stressDelta - 0.005))
          
          const lifeHours = prob > 0.1 ? Math.max(1, Math.round((1 - prob) * 720)) : 720

          return { ...n, failureProbability: prob, predictedLifeRemaining: lifeHours }
        })

        updatedNodes.forEach(n => {
          if ((n.failureProbability ?? 0) > 0.8 && !n.activeMigration && n.type === 'compute') {
            const candidates = updatedNodes.filter(c => 
              c.id !== n.id && c.type === 'compute' && c.siteId === n.siteId && 
              (c.failureProbability ?? 0) < 0.3 && c.healthStatus !== 'critical' && !c.isInfected
            )
            if (candidates.length > 0) {
              const target = candidates.sort((a, b) => (a.failureProbability ?? 0) - (b.failureProbability ?? 0))[0]
              const idx = updatedNodes.findIndex(x => x.id === n.id)
              if (idx >= 0) {
                updatedNodes[idx] = { ...updatedNodes[idx], activeMigration: { targetNodeId: target.id, progress: 0 } }
              }
              pushAlert('warning', `🧠 AI PREDICTION: ${n.name} failure probability ${((n.failureProbability ?? 0) * 100).toFixed(0)}%. Initiating predictive migration to ${target.name}.`, n.id)
            }
          }
          
          if (n.activeMigration) {
            const idx = updatedNodes.findIndex(x => x.id === n.id)
            if (idx >= 0) {
              const newProgress = (n.activeMigration.progress ?? 0) + 20
              if (newProgress >= 100) {
                updatedNodes[idx] = { ...updatedNodes[idx], activeMigration: null, failureProbability: Math.max(0, (n.failureProbability ?? 0) - 0.3) }
                pushAlert('info', `✅ MIGRATION COMPLETE: Workloads from ${n.name} safely migrated.`, n.id)
              } else {
                updatedNodes[idx] = { ...updatedNodes[idx], activeMigration: { ...n.activeMigration, progress: newProgress } }
              }
            }
          }
        })

        set({ nodes: updatedNodes })
      },

      simulateStressTest: () => {
        const { nodes, pushAlert } = get()
        const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling' && n.healthStatus !== 'critical')
        if (hardware.length === 0) {
          pushAlert('info', 'No hardware available for stress test.')
          return
        }
        const target = hardware[Math.floor(Math.random() * hardware.length)]
        set(state => ({
          nodes: state.nodes.map(n => n.id === target.id ? { ...n, failureProbability: 0.75 + Math.random() * 0.2 } : n)
        }))
        pushAlert('warning', `🔬 STRESS TEST: Artificially elevated failure probability on ${target.name} to trigger AI intervention.`, target.id)
      },

      toggleChaosMode: () => {
        const { isChaosMode, pushAlert } = get()
        set({ isChaosMode: !isChaosMode })
        pushAlert('warning', !isChaosMode ? '🔴 CHAOS MODE ENABLED: Random partial failures will be injected.' : '🟢 CHAOS MODE DISABLED: System stabilizing.')
      },

      processChaosLoop: () => {
        const { isChaosMode, nodes, connections, pushAlert, updateNode } = get()
        if (!isChaosMode) return
        if (Math.random() > 0.25) return

        const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling' && n.healthStatus !== 'critical' && !n.isInfected)
        if (hardware.length === 0) return

        const target = hardware[Math.floor(Math.random() * hardware.length)]
        const chaosType = Math.random()
        const rcaReasons = ['Thermal spike detected', 'SFP port degradation', 'Memory ECC error burst', 'PSU voltage fluctuation', 'NIC firmware hang', 'Disk I/O timeout']
        const rca = rcaReasons[Math.floor(Math.random() * rcaReasons.length)]

        if (chaosType < 0.4) {
          updateNode(target.id, { healthStatus: 'degraded' })
          pushAlert('warning', `⚡ CHAOS: ${target.name} degraded. RCA: ${rca}`, target.id)
        } else if (chaosType < 0.7) {
          const affectedConns = connections.filter(c => c.startNodeId === target.id || c.endNodeId === target.id)
          if (affectedConns.length > 0) {
            set(state => ({
              connections: state.connections.map(c => 
                affectedConns.some(ac => ac.id === c.id) ? { ...c, throughputGbps: c.bandwidthGbps * 0.2 } : c
              )
            }))
            pushAlert('warning', `⚡ CHAOS: Throughput dropped 80% on ${target.name} links. RCA: ${rca}`, target.id)
          }
        } else {
          updateNode(target.id, { healthStatus: 'degraded', failureProbability: Math.min(1, (target.failureProbability ?? 0) + 0.35) })
          pushAlert('warning', `⚡ CHAOS: Power anomaly on ${target.name}. RCA: ${rca}`, target.id)
        }
      },

      toggleGlobalMap: () => set(state => ({ isGlobalMapOpen: !state.isGlobalMapOpen })),

      processGeoRouting: () => {
        // Day 30: Geo-routing logic for multi-site SLAs
      },

      processTenancyEffect: () => {
        // Tenant noisy neighbor logic
      },

      validateReplication: (sourceId, targetId) => {
        const { nodes, sites, pushAlert } = get()
        const source = nodes.find(n => n.id === sourceId)
        const target = nodes.find(n => n.id === targetId)
        if (!source || !target) return true

        const sourceSite = sites.find(s => s.id === source.siteId)
        const targetSite = sites.find(s => s.id === target.siteId)
        if (!sourceSite || !targetSite) return true

        // Sovereignty Rule: PII in EU-West must stay in region
        if (source.dataCategory === 'PII' && sourceSite.region.includes('EU') && sourceSite.region !== targetSite.region) {
          const log: AuditLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'SovereigntyViolation',
            message: `Blocked PII replication from ${sourceSite.region} to ${targetSite.region}`,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            status: 'Blocked'
          }
          set(state => ({ auditLogs: [log, ...state.auditLogs].slice(0, 50) }))
          pushAlert('critical', `🛑 COMPLIANCE BLOCK: PII data cannot leave ${sourceSite.region}!`)
          return false
        }

        return true
      },

      checkAllCompliance: () => {
        const { validateReplication } = get()
        set(state => ({
          connections: state.connections.map(c => {
            const isBlocked = !validateReplication(c.startNodeId, c.endNodeId)
            return {
              ...c,
              isBlockedByCompliance: isBlocked,
              status: isBlocked ? 'blocked' : 'active',
              throughputGbps: isBlocked ? 0 : c.throughputGbps
            }
          })
        }))
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
        if (cashBalance < 100) {
          pushAlert('critical', 'Insufficient funds for service installation ($100 required).')
          return
        }

        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        const ports: Record<ServiceType, number> = { web: 80, storage: 445, backup: 5544 }
        const newService: NodeService = {
          id: crypto.randomUUID(),
          type,
          status: 'stopped',
          port: ports[type]
        }

        updateNode(nodeId, { 
          services: [...(node.services || []), newService]
        })
        set({ cashBalance: cashBalance - 100 })
        pushAlert('info', `Service ${type.toUpperCase()} installed on ${node.name}.`)
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

        const { nodes, updateNode, alerts, writeTerminalFile, setTerminalAlias, setTerminalEnvVar } = get()
        
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
        if (cmdLower === 'help') {
          output.push("--- [[GREEN]]v1.3 HIGH-FIDELITY MANAGEMENT CONSOLE[[RESET]] ---")
          output.push("SHELL: alias [n]=[c], export [V]=[K], watch [c], nano [f], > [f]")
          output.push("NAV: [[BLUE]]ls -la[[RESET]], [[BLUE]]cd[[RESET]], [[BLUE]]pwd[[RESET]], [[RED]]clear[[RESET]], [[BLUE]]man [topic][[RESET]]")
          output.push("NET: [[GREEN]]show ip int brief[[RESET]], [[GREEN]]show vlan brief[[RESET]], nmap, traceroute")
          output.push("ONTAP: [[BLUE]]vserver show[[RESET]], [[BLUE]]cluster health show[[RESET]], volume expand")
          output.push("RUBRIK: [[GREEN]]sla list[[RESET]], protection_status, snapshot create")
          output.push("SEC: [[RED]]iptables -L[[RESET]], nmap -v -A [IP]")
          output.push("PANE SPLITS: [[YELLOW]]Ctrl+Shift+V (Vert), Ctrl+Shift+H (Horiz)[[RESET]]")
        } else if (cmdLower === 'clear') {
          forceClear = true
        } else if (cmdLower === 'top') {
          newContext = { mode: 'top', targetId: null }
          output.push("Starting interactive resource monitor...")
        } else if (cmdLower === 'nano') {
          const path = args[1]
          if (!path) {
            output.push("usage: [[YELLOW]]nano [file][[RESET]]")
          } else {
            const fullPath = path.startsWith('/') ? path : `${newCwd}${newCwd === '/' ? '' : '/'}${path}`
            newContext = { mode: 'nano', targetId: fullPath }
            if (!siteState.storedFiles[fullPath]) {
              writeTerminalFile(fullPath, "") 
            }
          }
        } else if (cmdLower === 'alias') {
          if (!args[1]) {
            Object.entries(siteState.aliases).forEach(([k, v]) => output.push(`alias ${k}='${v}'`))
          } else {
            const aliasPart = processedCmd.slice(6).trim()
            const [name, ...cmdParts] = aliasPart.split('=')
            const cmd = cmdParts.join('=').replace(/^['"]|['"]$/g, '')
            setTerminalAlias(name.trim(), cmd)
            output.push(`Alias '${name}' defined.`)
          }
        } else if (cmdLower === 'export') {
          const exportPart = processedCmd.slice(7).trim()
          const [name, ...valParts] = exportPart.split('=')
          const val = valParts.join('=').replace(/^['"]|['"]$/g, '')
          setTerminalEnvVar(name.trim(), val)
          output.push(`Environment variable '${name}' exported.`)
        } else if (cmdLower === 'ls') {
          if (args.includes('-la')) {
            output.push("total 48")
            output.push("drwxr-xr-x  2 root  root  4096 May 1  12:00 [[BLUE]]bin[[RESET]]")
            output.push("drwxr-xr-x  2 root  root  4096 May 1  12:00 [[BLUE]]etc[[RESET]]")
            output.push("drwxr-xr-x  2 root  root  4096 May 1  12:00 [[BLUE]]root[[RESET]]")
            Object.entries(siteState.storedFiles).forEach(([k, v]) => {
              output.push(`-rw-r--r--  1 root  root  ${v.length} May 2  14:22 [[GREEN]]${k.split('/').pop()}[[RESET]]`)
            })
          } else {
            output.push("[[BLUE]]bin[[RESET]]  [[BLUE]]etc[[RESET]]  [[BLUE]]root[[RESET]]  " + Object.keys(siteState.storedFiles).map(f => `[[GREEN]]${f.split('/').pop()}[[RESET]]`).join('  '))
          }
        } else if (cmdLower === 'show' && args[1] === 'ip' && args[2] === 'int' && args[3] === 'brief') {
          output.push("Interface              IP-Address      OK? Method Status                Protocol")
          output.push("---------------------- --------------- --- ------ --------------------- ---------")
          nodes.filter(n => n.siteId === siteId && n.type !== 'rack').slice(0, 12).forEach(n => {
            const ip = n.ports[0]?.ip || 'unassigned'
            const status = Math.random() > 0.05 ? "[[GREEN]]up[[RESET]]" : "[[RED]]down[[RESET]]"
            output.push(`${n.name.padEnd(22)} ${ip.padEnd(15)} YES manual ${status.padEnd(30)} ${status}`)
          })
        } else if (cmdLower === 'show' && args[1] === 'vlan' && args[2] === 'brief') {
          output.push("VLAN Name                             Status    Ports")
          output.push("---- -------------------------------- --------- -------------------------------")
          output.push("1    default                          [[GREEN]]active[[RESET]]    Gi1/0/1, Gi1/0/2, Gi1/0/3")
          output.push("10   MGMT_VLAN                        [[GREEN]]active[[RESET]]    Gi1/0/24")
          output.push("100  PROD_DATA                        [[GREEN]]active[[RESET]]    Gi1/0/48")
          output.push("666  QUARANTINE                       [[RED]]suspended[[RESET]]")
        } else if (cmdLower === 'cluster' && args[1] === 'health' && args[2] === 'show') {
          output.push("Node            Health  Eligibility   Epsilon")
          output.push("--------------- ------- ------------  -------")
          nodes.filter(n => n.siteId === siteId && n.type === 'storage').forEach(n => {
            output.push(`${n.name.padEnd(15)} [[GREEN]]true[[RESET]]   true          false`)
          })
        } else if (cmdLower === 'sla' && args[1] === 'list') {
          output.push("SLA Domain           Gold Copy    Retention    Status")
          output.push("-------------------- ------------ ------------ ----------------")
          output.push("Gold-Standard        Yes          7 Years      [[GREEN]]COMPLIANT[[RESET]]")
          output.push("Silver-Tier          Yes          3 Years      [[GREEN]]COMPLIANT[[RESET]]")
          output.push("Bronze-Dev           No           30 Days      [[YELLOW]]WARNING[[RESET]]")
        } else if (cmdLower === 'cat') {
          const path = args[1]
          if (siteState.storedFiles[path]) output.push(...siteState.storedFiles[path].split('\n'))
          else if (siteState.storedFiles[`/etc/${path}`]) output.push(...siteState.storedFiles[`/etc/${path}`].split('\n'))
          else output.push(`[[RED]]cat: ${path}: No such file or directory[[RESET]]`)
        } else if (cmdLower === 'ssh') {
          const ip = args[1]
          const node = nodes.find(n => n.ports.some(p => p.ip === ip) && n.siteId === siteId)
          if (node) {
            newContext = { mode: 'ssh', targetId: node.id }
            output.push(`[[GREEN]]Connection established to ${node.name} (${ip})[[RESET]]`)
            output.push(`Last login: ${new Date().toLocaleString()} from bastion.infra`)
          } else output.push(`[[RED]]ssh: connect to host ${ip} port 22: Connection timed out[[RESET]]`)
        } else if (cmdLower === 'ping') {
          const target = args[1]
          output.push(`[[BLUE]]PING ${target} (56(84) bytes of data)[[RESET]]`)
          for(let i=1; i<=4; i++) {
            output.push(`64 bytes from ${target}: icmp_seq=${i} ttl=64 time=${(Math.random()*2+1).toFixed(2)} ms`)
          }
        } else if (cmdLower === 'echo') {
          output.push(args.slice(1).join(' '))
        } else if (cmdLower === 'exit') {
          if (newContext.mode !== 'global') {
            newContext = { mode: 'global', targetId: null }
            output.push("[[YELLOW]]Connection closed. Session detached.[[RESET]]")
          } else {
            // If already global, close the pane
            setTimeout(() => get().closeTerminalPane(pane.id), 50)
            return
          }
        } else if (cmdLower === 'sh') {
          const path = args[1]
          if (siteState.storedFiles[path]) {
            const scriptLines = siteState.storedFiles[path].split('\n').filter(l => l.trim() && !l.startsWith('#'))
            output.push(`[[BLUE]]Executing script: ${path}...[[RESET]]`)
            setTimeout(() => {
              scriptLines.forEach(line => get().processCommand(line))
            }, 10)
            return
          } else output.push(`[[RED]]sh: ${path}: No such file[[RESET]]`)
        } else {
          // Fallback
          if (cmdLower === 'pwd') output.push(newCwd)
          else if (cmdLower === 'history') pane.history.forEach((h, i) => output.push(`${(i+1).toString().padEnd(3)} ${h}`))
          else if (cmdLower === 'man') {
            const topic = args[1]
            if (TECHNICAL_MANUALS[topic]) output.push(...TECHNICAL_MANUALS[topic])
            else output.push(`[[RED]]Manual entry for '${topic}' not found.[[RESET]]`)
          } else output.push(`-bash: [[YELLOW]]${cmdLower}[[RESET]]: command not found`)
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
        const assetTag = node.assetTag || `ACC-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const normalizedNode = node.catalogKey != null
          ? { ...node, siteId: node.siteId || get().currentSiteId, assetTag, ports: createPortsForCatalog(node.id, node.catalogKey), services: node.services || [] }
          : { ...node, siteId: node.siteId || get().currentSiteId, assetTag, services: node.services || [] }
        
        // Add default install date and degradation
        if (normalizedNode.installDate === undefined) {
          normalizedNode.installDate = get().simulationCycle
          normalizedNode.degradation = 0
          // Day 6: New hardware is unconfigured
          if (normalizedNode.type !== 'rack' && normalizedNode.type !== 'facility') {
            normalizedNode.isConfigured = false
          } else {
            normalizedNode.isConfigured = true
          }
        }

        set((state) => ({ nodes: [...state.nodes, normalizedNode] }))
        if (normalizedNode.type === 'rack') calculateRackPower(normalizedNode.id)
        else if (normalizedNode.parentRackId) calculateRackPower(normalizedNode.parentRackId)
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
        if (state.cableMode && id !== null) return { selectedNodeId: id }
        return { selectedNodeId: id, cableMode: false, connectingPort: null }
      }),

      handlePortClick: (nodeId, portId) => {
        const { cableMode, connectingPort, validateReplication } = get()
        if (!cableMode) set({ cableMode: true, connectingPort: { nodeId, portId } })
        else {
          if (connectingPort?.nodeId === nodeId && connectingPort?.portId === portId) {
            set({ cableMode: false, connectingPort: null })
            return
          }
          
          const isBlocked = !validateReplication(connectingPort!.nodeId, nodeId)
          
          const newConnection: Connection = {
            id: crypto.randomUUID(),
            startNodeId: connectingPort!.nodeId,
            startPortId: connectingPort!.portId,
            endNodeId: nodeId,
            endPortId: portId,
            bandwidthGbps: Math.floor(Math.random() * 100) + 10,
            throughputGbps: 0,
            latencyMs: Math.random() > 0.7 ? Math.floor(Math.random() * 40) + 11 : Math.floor(Math.random() * 9) + 1,
            isBlockedByCompliance: isBlocked,
            status: isBlocked ? 'blocked' : 'active',
            syncProgress: 0
          }
          set((state) => ({
            connections: [...state.connections, newConnection],
            cableMode: false,
            connectingPort: null,
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
        const { nodes, connections } = get()
        const targetNode = nodes.find(n => n.ports.some(p => p.ip === targetIp))
        if (!targetNode) return { success: false, message: `PING ${targetIp}: Host unreachable (No device with this IP).` }
        
        const hasPath = connections.some(c => 
          (c.startNodeId === sourceId && c.endNodeId === targetNode.id) ||
          (c.startNodeId === targetNode.id && c.endNodeId === sourceId)
        )

        if (!hasPath) return { success: false, message: `PING ${targetIp}: Request timed out (No route to host).` }
        
        const isUp = targetNode.ports.some(p => p.ip === targetIp && p.status === 'up')
        if (!isUp) return { success: false, message: `PING ${targetIp}: Destination port is DOWN.` }

        return { success: true, message: `64 bytes from ${targetIp}: icmp_seq=1 ttl=64 time=${Math.floor(Math.random() * 5) + 1}ms` }
      },

      processTick: () => {
        const { activeContracts, totalPowerKW, cashBalance, pushAlert, nodes, connections } = get()
        
        const rentCost = 50
        const powerCost = totalPowerKW * 0.05
        
        // Calculate Revenue based on Service SLAs
        let totalRevenue = 0
        activeContracts.forEach(gig => {
          let satisfied = true
          if (gig.serviceRequirements) {
            gig.serviceRequirements.forEach(req => {
              // Find nodes in current DC running this service
              const providerNodes = nodes.filter(n => 
                n.services?.some(s => s.type === req.type && s.status === 'running')
              )

              // Check reachability for each provider
              const reachableProviders = providerNodes.filter(n => {
                const hasUpPort = n.ports.some(p => p.status === 'up')
                const hasConnection = connections.some(c => c.startNodeId === n.id || c.endNodeId === n.id)
                return hasUpPort && hasConnection
              })

              if (reachableProviders.length < req.count) {
                satisfied = false
              }
            })
          }

          if (satisfied) {
            totalRevenue += gig.reward
          }
        })
        
        const netProfit = totalRevenue - rentCost - powerCost
        const newBalance = cashBalance + netProfit
        
        set({ cashBalance: newBalance, lastTickProfit: netProfit })
        
        if (newBalance < 0) {
          pushAlert('critical', 'SYSTEM OVERDRAFT: Bank balance has dropped below zero!')
        }
      },

      acceptContract: (gig) => set(state => ({
        activeContracts: [...state.activeContracts, gig]
      })),

      resetCareer: () => set({
        nodes: [],
        connections: [],
        cashBalance: 10000,
        lastTickProfit: 0,
        activeContracts: [],
        terminalContext: { mode: 'global' },
        alerts: [],
        simulationCycle: 0,
        deploymentQueue: [],
        shoppingCart: [],
        isHeatMapVisible: false,
        terminalStates: {
          'site-1': { 
            sessions: [{ 
              id: 's1-1', 
              title: 'Primary Bastion', 
              panes: [{ id: 'p1-1', logs: ['Enterprise Console v1.3 Ready.'], history: [], cwd: '/', context: { mode: 'global', targetId: null } }],
              activePaneId: 'p1-1',
              layout: 'single'
            }],
            activeSessionId: 's1-1',
            layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
            aliases: { 'll': 'ls -la' },
            envVars: { 'USER': 'admin' },
            storedFiles: { '/etc/motd': 'Welcome back, Architect.' }
          },
          'site-2': { 
            sessions: [{ 
              id: 's2-1', 
              title: 'DR Bastion', 
              panes: [{ id: 'p2-1', logs: ['DR Console v1.3 Ready.'], history: [], cwd: '/', context: { mode: 'global', targetId: null } }],
              activePaneId: 'p2-1',
              layout: 'single'
            }],
            activeSessionId: 's2-1',
            layout: { width: 850, height: 550, x: 100, y: 120, isMaximized: false },
            aliases: {},
            envVars: { 'USER': 'admin' },
            storedFiles: { '/etc/motd': 'DR Site Management Console' }
          }
        },
      }),
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