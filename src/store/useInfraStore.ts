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
  ports: HardwarePort[]
  assetTag?: string
  serialNumber?: string
}

export interface Connection {
  id: string
  startNodeId: string
  startPortId: string
  endNodeId: string
  endPortId: string
  bandwidthGbps: number
  latencyMs: number
}

type InfraState = {
  nodes: InfraNode[]
  connections: Connection[]
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
  setNetworkManagerOpen: (open: boolean) => void
  setCurrentSiteId: (siteId: string) => void
  setMousePosition: (pos: Vector3 | null) => void
  initiateFailover: () => void
  pushAlert: (severity: AlertSeverity, message: string) => void
  simulateRandomFailure: () => void
  simulateDataCorruption: () => void
  triggerSiteDisaster: () => void
  processAutoBackups: () => void
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  handlePortClick: (nodeId: string, portId: string) => void
  addReplicationLink: (sourceId: string, targetId: string) => void
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

      setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
      setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
      setMousePosition: (pos) => set({ mousePosition: pos }),

      pushAlert: (severity, message) => {
        set((state) => ({
          alerts: [{ id: crypto.randomUUID(), timestamp: Date.now(), severity, message }, ...state.alerts].slice(0, 50)
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
        pushAlert('critical', `Hardware Failure: ${target.name} (${target.id.slice(0,6)}) has entered a critical state!`)
      },

      simulateDataCorruption: () => {
        const { nodes, pushAlert, updateNode } = get()
        const storages = nodes.filter(n => (n.type === 'storage' || n.type === 'backup' || n.type === 'compute') && (n.totalStorageTB ?? 0) > 0)
        if (storages.length === 0) return

        const target = storages[Math.floor(Math.random() * storages.length)]
        if (target.isImmutable) {
          pushAlert('info', `SECURITY BLOCK: Ransomware attempt on ${target.name} thwarted by Immutable Snapshots!`)
        } else {
          updateNode(target.id, { healthStatus: 'critical', usedStorageTB: 0, backupStatus: 'unprotected' })
          pushAlert('critical', `RANSOMWARE ATTACK: ${target.name} (${target.id.slice(0,6)}) data wiped! Storage lost.`)
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
            latencyMs: Math.random() > 0.7 ? Math.floor(Math.random() * 40) + 11 : Math.floor(Math.random() * 9) + 1,
          }

          set((state) => ({
            connections: [...state.connections, newConnection],
            cableMode: false,
            connectingPort: null,
          }))
        }
      },

      addReplicationLink: (sourceId, targetId) => {
        const { nodes, connections, pushAlert } = get()
        const source = nodes.find(n => n.id === sourceId)
        const target = nodes.find(n => n.id === targetId)

        if (!source || !target) {
          pushAlert('warning', 'Invalid source or target node.')
          return
        }

        if (source.catalogKey !== target.catalogKey) {
          pushAlert('critical', 'Replication Failed: Incompatible hardware types! Can only replicate between identical systems (e.g., Rubrik to Rubrik).')
          return
        }

        // Find available ports
        const usedStartPorts = new Set(connections.map(c => c.startPortId).concat(connections.map(c => c.endPortId)))
        const sourcePort = source.ports.find(p => !usedStartPorts.has(p.id))
        const targetPort = target.ports.find(p => !usedStartPorts.has(p.id))

        if (!sourcePort || !targetPort) {
          pushAlert('warning', 'Replication Failed: Insufficient free ports on source or target node.')
          return
        }

        const newConnection: Connection = {
          id: crypto.randomUUID(),
          startNodeId: source.id,
          startPortId: sourcePort.id,
          endNodeId: target.id,
          endPortId: targetPort.id,
          bandwidthGbps: 10,
          latencyMs: 35, // Typical WAN latency
        }

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
        
        const node = get().nodes.find(n => n.id === id)
        if (node) {
           if (node.type === 'rack') calculateRackPower(id)
           else if (node.parentRackId) calculateRackPower(node.parentRackId)
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