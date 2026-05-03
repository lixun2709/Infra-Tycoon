import { Vector3 } from 'three'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  HARDWARE_CATALOG,
  type HardwareCatalogKey,
  type PortType,
} from '../physics/hardwareLibrary'
import { findFirstEmptySlot } from '../physics/snapping'
import { calculateRackPower, recalculateRoomStats } from '../physics/powerEngine'

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

export type InfraNode = {
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
  terminalLogs: string[]
  commandHistory: string[]
  assistantTargetId: string | null
  terminalContext: { mode: 'global' | 'config' | 'interface'; targetId?: string }

  cashBalance: number
  lastTickProfit: number
  activeContracts: Gig[]
  
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
      terminalLogs: ['System Ready. Type "help" for commands.'],
      commandHistory: [],
      assistantTargetId: null,
      terminalContext: { mode: 'global' },

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

      processCommand: (text) => {
        const { nodes, refreshHardware, performMassRollback, selectedNodeId, installService, ping, terminalContext } = get()
        const cmd = text.toLowerCase().trim()
        const logs = [...get().terminalLogs, `> ${text}`]
        const selectedNode = nodes.find(n => n.id === selectedNodeId)

        if (cmd === 'help') {
          if (terminalContext.mode === 'global') {
            logs.push('Global: conf t, fix, scale, secure, report, clear, autopilot')
            logs.push('Network: ping [ip], hostname [name], ip addr show')
          } else if (terminalContext.mode === 'config') {
            logs.push('Config: interface [name], exit, end')
          } else if (terminalContext.mode === 'interface') {
            logs.push('Interface: no shut, shut, ip address [ip] [mask], exit, end')
          }
        } else if (cmd === 'clear') {
          set({ terminalLogs: [] })
          return
        } else if (cmd === 'conf t' || cmd === 'configure terminal') {
          set({ terminalContext: { mode: 'config' } })
          logs.push('Enter configuration commands, one per line. End with CNTL/Z.')
        } else if (cmd === 'exit') {
          if (terminalContext.mode === 'interface') set({ terminalContext: { mode: 'config' } })
          else if (terminalContext.mode === 'config') set({ terminalContext: { mode: 'global' } })
          else logs.push('Error: Already at root level.')
        } else if (cmd === 'end') {
          set({ terminalContext: { mode: 'global' } })
        } else if (cmd.startsWith('interface ') && terminalContext.mode === 'config') {
          const portLabel = cmd.split(' ')[1]
          if (selectedNode) {
            const port = selectedNode.ports.find(p => p.label.toLowerCase() === portLabel)
            if (port) {
              set({ terminalContext: { mode: 'interface', targetId: port.id } })
              logs.push(`Entering configuration for interface ${port.label}.`)
            } else {
              logs.push(`Error: Interface ${portLabel} not found.`)
            }
          }
        } else if (cmd === 'no shut' && terminalContext.mode === 'interface' && terminalContext.targetId) {
          if (selectedNode) {
            const newPorts = selectedNode.ports.map(p => p.id === terminalContext.targetId ? { ...p, status: 'up' as const } : p)
            get().updateNode(selectedNode.id, { ports: newPorts })
            logs.push(`Interface ${selectedNode.ports.find(p => p.id === terminalContext.targetId)?.label} is now UP.`)
          }
        } else if (cmd === 'shut' && terminalContext.mode === 'interface' && terminalContext.targetId) {
          if (selectedNode) {
            const newPorts = selectedNode.ports.map(p => p.id === terminalContext.targetId ? { ...p, status: 'down' as const } : p)
            get().updateNode(selectedNode.id, { ports: newPorts })
            logs.push(`Interface ${selectedNode.ports.find(p => p.id === terminalContext.targetId)?.label} is now DOWN.`)
          }
        } else if (cmd.startsWith('ip address ') && terminalContext.mode === 'interface' && terminalContext.targetId) {
          const parts = cmd.split(' ')
          const ip = parts[2]
          const mask = parts[3] || '255.255.255.0'
          if (selectedNode && ip) {
            const newPorts = selectedNode.ports.map(p => p.id === terminalContext.targetId ? { ...p, ip, mask } : p)
            get().updateNode(selectedNode.id, { ports: newPorts })
            logs.push(`Assigned IP ${ip} to interface.`)
          }
        } else if (cmd.startsWith('ping ')) {
          const targetIp = cmd.split(' ')[1]
          if (selectedNode) {
            const res = ping(selectedNode.id, targetIp)
            logs.push(res.message)
          } else {
            logs.push('Error: Select a source node first.')
          }
        } else if (cmd.startsWith('hostname ')) {
          const newName = text.slice(9).trim()
          if (selectedNodeId && newName) {
            get().updateNode(selectedNodeId, { name: newName })
            logs.push(`Hostname updated to: ${newName}`)
          }
        } else if (cmd.startsWith('service install ')) {
          const type = cmd.split(' ')[2] as ServiceType
          if (selectedNodeId) {
            installService(selectedNodeId, type)
            logs.push(`Installing ${type}...`)
          } else {
            logs.push('Error: No node selected.')
          }
        } else if (cmd === 'ip addr show' || cmd === 'ip a') {
          if (selectedNode) {
            selectedNode.ports.forEach(p => {
              logs.push(`${p.label}: <UP,LOWER_UP> mtu 1500 state ${p.status.toUpperCase()}`)
              if (p.ip) logs.push(`    inet ${p.ip}/${p.mask || '24'} brd 255.255.255.255 scope global`)
            })
          } else {
            logs.push('Error: No node selected.')
          }
        } else if (cmd.includes('fix')) {
          const criticals = nodes.filter(n => n.healthStatus === 'critical')
          criticals.forEach(n => refreshHardware(n.id))
          logs.push(`Initiated repair for ${criticals.length} critical systems.`)
        } else if (cmd.includes('secure')) {
          performMassRollback()
          logs.push('Executing global security rollback & immutable snapshot verification.')
        } else if (cmd.includes('scale')) {
          set({ networkLoad: 0.8 })
          logs.push('Scaling throughput parameters to 80% capacity.')
        } else if (cmd.includes('autopilot')) {
          get().toggleAutoPilot()
          logs.push(`Auto-Pilot mode set to ${!get().isAutoPilot}`)
        } else if (cmd.includes('report')) {
          const r = get().generateFinalReport()
          logs.push(`FINAL REPORT: Grade ${r.grade} (Score: ${r.score})`)
        } else {
          logs.push(`Unknown command: ${cmd}`)
        }

        set({ 
          terminalLogs: logs.slice(-50),
          commandHistory: [...get().commandHistory, text].slice(-50)
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
      }),
    }),
    {
      name: 'infra-tycoon-state',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (rehydratedState) => {
        if (rehydratedState) {
          const s = rehydratedState as InfraState
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