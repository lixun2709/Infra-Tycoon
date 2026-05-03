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
}

export type Tenant = {
  id: string
  name: string
  color: string
  budget: number
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
  assistantTargetId: string | null
  
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
  // Day 30 Actions
  processCommand: (text: string) => void
  toggleAutoPilot: () => void
  processAutoPilot: () => void
  generateFinalReport: () => { score: number, grade: string, breakdown: any }
  
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
}

const catalogDisplayName: Record<HardwareCatalogKey, string> = {
  COMPUTE_1U: 'Compute (1U)',
  NETAPP_STORAGE_2U: 'NetApp Shelf (2U)',
  RUBRIK_BACKUP_2U: 'Rubrik Node (2U)',
  SWITCH_1U: 'Switch (1U)',
  CRAC_UNIT_4U: 'CRAC Unit (4U)',
  LOAD_BALANCER_1U: 'Load Balancer (1U)',
}

function createPortsForCatalog(nodeId: string, key: HardwareCatalogKey): HardwarePort[] {
  const { portLayout } = HARDWARE_CATALOG[key]
  return portLayout.flatMap((segment) =>
    Array.from({ length: segment.count }, (_, idx) => ({
      id: `${nodeId}-${segment.type}-${idx + 1}`,
      type: segment.type,
      label: `${segment.labelPrefix}${idx}`,
      connectedTo: null,
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
      assistantTargetId: null,

      setNetworkLoad: (load) => set({ networkLoad: load }),
      setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
      setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
      setMousePosition: (pos) => set({ mousePosition: pos }),

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
        const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling' && n.healthStatus !== 'critical' && !n.isInfected)
        
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
        const { isChaosMode, nodes, connections, pushAlert, updateNode, resilienceIndex, incidentCounter, postMortems } = get()
        if (!isChaosMode) return
        if (Math.random() > 0.25) return

        const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling' && n.healthStatus !== 'critical' && !n.isInfected)
        if (hardware.length === 0) return

        const target = hardware[Math.floor(Math.random() * hardware.length)]
        const chaosType = Math.random()
        const rcaReasons = ['Thermal spike detected', 'SFP port degradation', 'Memory ECC error burst', 'PSU voltage fluctuation', 'NIC firmware hang', 'Disk I/O timeout']
        const rca = rcaReasons[Math.floor(Math.random() * rcaReasons.length)]

        let wasHandledByAI = false
        let impact = 'Brief performance degradation'

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

        if ((target.failureProbability ?? 0) > 0.6 || target.activeMigration) {
          wasHandledByAI = true
          impact = 'Zero downtime (AI pre-mitigated)'
        }

        const newResilience = wasHandledByAI ? Math.min(100, resilienceIndex + 2) : Math.max(0, resilienceIndex - 1)
        const mitigationStr = wasHandledByAI ? `AI pre-detected risk and rerouted traffic in ${(Math.random() * 3 + 0.5).toFixed(1)}s` : 'Manual intervention required'
        const newIncidentNum = incidentCounter + 1
        const newPostMortem: PostMortem = {
          id: crypto.randomUUID(),
          incidentNumber: newIncidentNum,
          timestamp: Date.now(),
          nodeName: target.name,
          nodeId: target.id,
          rca,
          mitigation: mitigationStr,
          impact,
        }

        set({ 
          resilienceIndex: newResilience, 
          incidentCounter: newIncidentNum,
          postMortems: [newPostMortem, ...postMortems].slice(0, 20)
        })
      },

      toggleGlobalMap: () => set(state => ({ isGlobalMapOpen: !state.isGlobalMapOpen })),

      processGeoRouting: () => {
        const { nodes, sites, pushAlert } = get()
        let totalCarbon = 0
        sites.forEach(site => {
          const siteHw = nodes.filter(n => n.siteId === site.id && n.type !== 'rack' && n.type !== 'cooling')
          const sitePower = siteHw.reduce((sum, n) => sum + (n.wattage / 1000), 0)
          const carbonFactor = site.energySource === 'Renewable' ? 0.05 : 0.5
          totalCarbon += sitePower * carbonFactor
        })
        set({ carbonFootprintKg: Math.round(totalCarbon * 100) / 100 })

        sites.forEach(site => {
          const siteHw = nodes.filter(n => n.siteId === site.id && n.type !== 'rack' && n.type !== 'cooling')
          if (siteHw.length === 0) return
          const healthyCount = siteHw.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
          const healthIndex = Math.round((healthyCount / siteHw.length) * 100)
          if (healthIndex < 40) {
            const healthySite = sites.find(s => {
              if (s.id === site.id) return false
              const otherHw = nodes.filter(n => n.siteId === s.id && n.type !== 'rack' && n.type !== 'cooling')
              if (otherHw.length === 0) return false
              const otherHealthy = otherHw.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
              return (otherHealthy / otherHw.length) > 0.6
            })
            if (healthySite) {
              const crossConns = get().connections.filter(c => {
                const startNode = nodes.find(n => n.id === c.startNodeId)
                const endNode = nodes.find(n => n.id === c.endNodeId)
                return (startNode?.siteId === site.id && endNode?.siteId === healthySite.id) ||
                       (endNode?.siteId === site.id && startNode?.siteId === healthySite.id)
              })
              if (crossConns.length > 0) {
                set(state => ({
                  connections: state.connections.map(c =>
                    crossConns.some(cc => cc.id === c.id) ? { ...c, throughputGbps: c.bandwidthGbps * 0.95 } : c
                  )
                }))
                pushAlert('warning', `🌐 GEO-ROUTING: ${site.region} health at ${healthIndex}%. Traffic shifted to ${healthySite.region}.`)
              }
            }
          }
        })
      },

      processTenancyEffect: () => {
        const { nodes, connections, pushAlert } = get()
        const tenantsWithSpikes = new Set<string>()
        
        nodes.forEach(n => {
          if (!n.tenantId) return
          const nodeConns = connections.filter(c => c.startNodeId === n.id || c.endNodeId === n.id)
          const totalThroughput = nodeConns.reduce((sum, c) => sum + c.throughputGbps, 0)
          const totalBandwidth = nodeConns.reduce((sum, c) => sum + c.bandwidthGbps, 0)
          
          if (totalBandwidth > 0 && (totalThroughput / totalBandwidth) > 0.8) {
            tenantsWithSpikes.add(n.tenantId)
          }
        })

        if (tenantsWithSpikes.size > 0) {
          set(state => ({
            connections: state.connections.map(c => {
              const startNode = state.nodes.find(n => n.id === c.startNodeId)
              const endNode = state.nodes.find(n => n.id === c.endNodeId)
              const isAffectedTenantNode = (startNode?.tenantId && tenantsWithSpikes.has(startNode.tenantId)) || 
                                           (endNode?.tenantId && tenantsWithSpikes.has(endNode.tenantId))
              
              const isQoSEnabled = startNode?.qosEnabled || endNode?.qosEnabled
              
              if (isAffectedTenantNode && !isQoSEnabled) {
                return { ...c, latencyMs: c.latencyMs + 20 }
              }
              return c
            })
          }))
          pushAlert('warning', '🏙️ NOISY NEIGHBOR: High tenant throughput detected. QoS-disabled nodes experiencing +20ms latency.')
        }
      },

      validateReplication: (sourceId, targetId) => {
        const { nodes, sites, pushAlert, auditLogs } = get()
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
        const { connections, validateReplication } = get()
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
        const { simulationCycle, totalEWasteKG, refreshCount, updateNode, nodes, pushAlert } = get()
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
              type: 'LifecycleEvent',
              message: `Refreshed hardware ${node.name}. Generated ${weight}kg E-Waste.`,
              sourceNodeId: nodeId,
              targetNodeId: nodeId,
              status: 'Info'
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

      processCommand: (text) => {
        const { nodes, refreshHardware, performMassRollback, pushAlert } = get()
        const cmd = text.toLowerCase().trim()
        const logs = [...get().terminalLogs, `> ${text}`]

        if (cmd === 'help') {
          logs.push('Available: fix, scale, secure, deploy, report, autopilot')
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

        set({ terminalLogs: logs.slice(-20) })
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
          ? { ...node, siteId: node.siteId || get().currentSiteId, assetTag, ports: createPortsForCatalog(node.id, node.catalogKey) }
          : { ...node, siteId: node.siteId || get().currentSiteId, assetTag }
        
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
        const { nodes, simulationCycle } = get()
        const targetRack = nodes.find(n => n.id === targetRackId)
        if (!targetRack || targetRack.type !== 'rack') return false
        const targetNodes = nodes.filter(n => n.id === targetRackId || n.parentRackId === targetRackId)
        const spec = HARDWARE_CATALOG[key]
        const placement = findFirstEmptySlot(targetNodes, spec.uHeight)
        if (!placement) {
          window.alert('No free slot found in the selected rack.')
          return false
        }
        const node: InfraNode = {
          id: crypto.randomUUID(),
          type: spec.type,
          name: catalogDisplayName[key],
          siteId: targetRack.siteId,
          position: new Vector3(targetRack.position.x, targetRack.position.y, targetRack.position.z),
          uHeight: spec.uHeight,
          wattage: spec.wattage,
          btuOutput: spec.btuOutput !== undefined ? spec.btuOutput : spec.wattage * 3.41,
          totalStorageTB: spec.storageTB,
          usedStorageTB: spec.storageTB > 0 ? Math.floor(Math.random() * (spec.storageTB * 0.7) + (spec.storageTB * 0.3)) : 0,
          isImmutable: key === 'RUBRIK_BACKUP_2U',
          clusterRole: 'active',
          backupStatus: 'unprotected',
          parentRackId: targetRackId,
          slotIndex: placement.slotIndex,
          catalogKey: key,
          ports: [],
          healthStatus: 'healthy',
          dataCategory: 'Internal',
          installDate: simulationCycle,
          degradation: 0
        }
        get().addNode(node)
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
      updateNodeQoS: (nodeId, enabled) => set(state => ({
        nodes: state.nodes.map(n => n.id === nodeId ? { ...n, qosEnabled: enabled } : n)
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
    }),
    {
      name: 'infra-tycoon-state',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: (state) => (rehydratedState) => {
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