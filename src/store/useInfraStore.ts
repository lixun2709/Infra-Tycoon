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

export type InfraAlert = {
  id: string
  timestamp: number
  severity: AlertSeverity
  message: string
  isAcknowledged: boolean
  nodeId?: string
}

export type Site = {
  id: string
  name: string
  isDisaster: boolean
}

export type HardwarePort = {
  id: string
  type: PortType
  label: string
  connectedTo: null | string
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
  isNetworkManagerOpen: boolean
  networkLoad: number
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
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  handlePortClick: (nodeId: string, portId: string) => void
  addReplicationLink: (sourceId: string, sourcePortId: string, targetId: string, targetPortId: string) => void
  removeConnection: (id: string) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
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
        { id: 'site-1', name: 'Primary-DC', isDisaster: false },
        { id: 'site-2', name: 'DR-Site', isDisaster: false }
      ],
      currentSiteId: 'site-1',
      placementMode: false,
      pendingRackType: null,
      alerts: [],
      isNetworkManagerOpen: false,
      networkLoad: 0.1,

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

        // Select multiple targets for a siege
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

          // Calculate stress factors
          const connThroughput = connections
            .filter(c => c.startNodeId === n.id || c.endNodeId === n.id)
            .reduce((sum, c) => sum + (c.throughputGbps / c.bandwidthGbps), 0)
          
          const thermalStress = Math.min(1, totalRoomBTU / 80000)
          const loadStress = networkLoad
          const storageStress = (n.totalStorageTB ?? 0) > 0 ? ((n.usedStorageTB ?? 0) / n.totalStorageTB!) : 0
          
          // Weighted failure probability
          let prob = (n.failureProbability ?? 0)
          const stressDelta = (thermalStress * 0.3 + loadStress * 0.3 + connThroughput * 0.2 + storageStress * 0.2) * 0.02
          prob = Math.min(1, Math.max(0, prob + stressDelta - 0.005)) // natural decay of 0.005
          
          const lifeHours = prob > 0.1 ? Math.max(1, Math.round((1 - prob) * 720)) : 720

          return { ...n, failureProbability: prob, predictedLifeRemaining: lifeHours }
        })

        // Check for proactive migrations
        updatedNodes.forEach(n => {
          if ((n.failureProbability ?? 0) > 0.8 && !n.activeMigration && n.type === 'compute') {
            // Find healthiest compute in same site
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
          
          // Progress existing migrations
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

      setPlacementMode: (mode, type = null) => set({ placementMode: mode, pendingRackType: type }),

      addNode: (node) => {
        const assetTag = node.assetTag || `ACC-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const normalizedNode = node.catalogKey != null
          ? { ...node, siteId: node.siteId || get().currentSiteId, assetTag, ports: createPortsForCatalog(node.id, node.catalogKey) }
          : { ...node, siteId: node.siteId || get().currentSiteId, assetTag }

        set((state) => ({ nodes: [...state.nodes, normalizedNode] }))
        
        if (normalizedNode.type === 'rack') {
          calculateRackPower(normalizedNode.id)
        } else if (normalizedNode.parentRackId) {
          calculateRackPower(normalizedNode.parentRackId)
        }
        recalculateRoomStats()
      },

      placeCatalogHardware: (key, targetRackId) => {
        const { nodes } = get()
        
        const targetRack = nodes.find(n => n.id === targetRackId)
        if (!targetRack || targetRack.type !== 'rack') {
          return false
        }

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
          parentRackId: placement.rackId,
          slotIndex: placement.slotIndex,
          catalogKey: key,
          ports: [],
          healthStatus: 'healthy',
        }

        get().addNode(node)
        return true
      },

      setSelectedNode: (id) => set((state) => {
        if (state.cableMode && id !== null) {
           return { selectedNodeId: id }
        }
        return { selectedNodeId: id, cableMode: false, connectingPort: null }
      }),

      handlePortClick: (nodeId, portId) => {
        const { cableMode, connectingPort } = get()

        if (!cableMode) {
          set({ cableMode: true, connectingPort: { nodeId, portId } })
        } else {
          if (connectingPort?.nodeId === nodeId && connectingPort?.portId === portId) {
            set({ cableMode: false, connectingPort: null })
            return
          }

          const newConnection: Connection = {
            id: crypto.randomUUID(),
            startNodeId: connectingPort!.nodeId,
            startPortId: connectingPort!.portId,
            endNodeId: nodeId,
            endPortId: portId,
            bandwidthGbps: Math.floor(Math.random() * 100) + 10,
            throughputGbps: 0,
            latencyMs: Math.random() > 0.7 ? Math.floor(Math.random() * 40) + 11 : Math.floor(Math.random() * 9) + 1,
          }

          set((state) => ({
            connections: [...state.connections, newConnection],
            cableMode: false,
            connectingPort: null,
          }))
        }
      },

      addReplicationLink: (sourceId, sourcePortId, targetId, targetPortId) => {
        const { nodes, connections, pushAlert } = get()
        const source = nodes.find(n => n.id === sourceId)
        const target = nodes.find(n => n.id === targetId)

        if (!source || !target || !sourcePortId || !targetPortId) {
          pushAlert('warning', 'Invalid source or target node/port.')
          return
        }

        if (source.catalogKey !== target.catalogKey) {
          pushAlert('critical', 'Replication Failed: Incompatible hardware types! Can only replicate between identical systems (e.g., Rubrik to Rubrik).')
          return
        }

        const usedPorts = new Set(connections.map(c => c.startPortId).concat(connections.map(c => c.endPortId)))
        if (usedPorts.has(sourcePortId) || usedPorts.has(targetPortId)) {
          pushAlert('warning', 'Replication Failed: One or both of the selected ports are already physically connected to another device.')
          return
        }

        const newConnection: Connection = {
          id: crypto.randomUUID(),
          startNodeId: source.id,
          startPortId: sourcePortId,
          endNodeId: target.id,
          endPortId: targetPortId,
          bandwidthGbps: 10,
          throughputGbps: 0,
          latencyMs: 35, // Typical WAN latency
        }

        // Set DR node as standby
        get().updateNode(target.id, { clusterRole: 'standby' })

        set((state) => ({ connections: [...state.connections, newConnection] }))
        pushAlert('info', `Replication Link established between ${source.name} and ${target.name}.`)
      },

      removeConnection: (id) => set(state => ({
        connections: state.connections.filter(c => c.id !== id)
      })),

      removeNode: (id) => {
        const nodeToRemove = get().nodes.find(n => n.id === id)
        if (!nodeToRemove) return

        const parentRackId = nodeToRemove.parentRackId

        set((state) => {
          const idsToRemove = new Set([id])
          if (nodeToRemove.type === 'rack') {
            state.nodes.forEach(n => {
              if (n.parentRackId === id) idsToRemove.add(n.id)
            })
          }

          return {
            nodes: state.nodes.filter(n => !idsToRemove.has(n.id)),
            connections: state.connections.filter(c => !idsToRemove.has(c.startNodeId) && !idsToRemove.has(c.endNodeId)),
            selectedNodeId: idsToRemove.has(state.selectedNodeId || '') ? null : state.selectedNodeId
          }
        })

        if (parentRackId) {
          calculateRackPower(parentRackId)
        }
        recalculateRoomStats()
      },

      updateNode: (id, updates) => {
        set((state) => ({
          nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
        }))
        
        const state = get()
        const node = state.nodes.find(n => n.id === id)
        if (node) {
           if (node.type === 'rack') calculateRackPower(id)
           else if (node.parentRackId) calculateRackPower(node.parentRackId)
           
           // Auto-Failover Logic
           if (updates.healthStatus === 'critical') {
             const replConn = state.connections.find(c => c.startNodeId === id || c.endNodeId === id)
             if (replConn) {
               const partnerId = replConn.startNodeId === id ? replConn.endNodeId : replConn.startNodeId
               const partner = state.nodes.find(n => n.id === partnerId)
               // Simple check if it's a replication link (same catalog type)
               if (partner && partner.catalogKey === node.catalogKey && partner.clusterRole !== 'active' && partner.healthStatus !== 'critical') {
                 // Prevent infinite loop by bypassing updateNode for partner, or just using updateNode carefully
                 // Actually, calling updateNode again is safe since updates.healthStatus is not 'critical'
                 set((s) => ({
                   nodes: s.nodes.map(n => n.id === partner.id ? { ...n, clusterRole: 'active' } : n)
                 }))
                 state.pushAlert('critical', `AUTO-FAILOVER INITIATED: ${node.name} failed. Traffic automatically routed to DR partner ${partner.name}.`, partner.id)
               }
             }
           }
        }
        recalculateRoomStats()
      },
    }),
    {
      name: 'infra-tycoon-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          let needsUpdate = false;
          const migratedNodes = state.nodes.map(n => {
            if (!n.siteId) {
              needsUpdate = true;
              return { ...n, siteId: 'site-1' }
            }
            return n;
          });
          
          if (needsUpdate) {
            useInfraStore.setState({ nodes: migratedNodes });
          }

          if (!state.sites || state.sites.length === 0) {
             useInfraStore.setState({
               sites: [
                  { id: 'site-1', name: 'Primary-DC', isDisaster: false },
                  { id: 'site-2', name: 'DR-Site', isDisaster: false }
               ],
               currentSiteId: 'site-1'
             });
          }
        }
      }
    }
  )
)