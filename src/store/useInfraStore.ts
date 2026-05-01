import { Vector3 } from 'three'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  HARDWARE_CATALOG,
  type HardwareCatalogKey,
  type PortType,
} from '../physics/hardwareLibrary'
import { findFirstEmptySlot } from '../physics/snapping'
import { calculateRackPower, recalculateRoomStats } from '../physics/powerEngine'

export type InfraNodeType = 'rack' | string
export type RackStatus = 'online' | 'power_overload'

export type HardwarePort = {
  id: string
  type: PortType
  label: string
  connectedTo: null | string
}

export type InfraNode = {
  id: string
  type: InfraNodeType
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
  placementMode: boolean
  pendingRackType: string | null
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  handlePortClick: (nodeId: string, portId: string) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
}

const catalogDisplayName: Record<HardwareCatalogKey, string> = {
  COMPUTE_1U: 'Compute (1U)',
  NETAPP_STORAGE_2U: 'NetApp Shelf (2U)',
  RUBRIK_BACKUP_2U: 'Rubrik Node (2U)',
  SWITCH_1U: 'Switch (1U)',
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
      placementMode: false,
      pendingRackType: null,

      setPlacementMode: (mode, type = null) => set({ placementMode: mode, pendingRackType: type }),

      addNode: (node) => {
        const assetTag = node.assetTag || `ACC-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const normalizedNode = node.catalogKey != null
          ? { ...node, assetTag, ports: createPortsForCatalog(node.id, node.catalogKey) }
          : { ...node, assetTag }

        set((state) => ({ nodes: [...state.nodes, normalizedNode] }))
        
        // Always calculate power explicitly when adding node
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
          position: new Vector3(targetRack.position.x, targetRack.position.y, targetRack.position.z),
          uHeight: spec.uHeight,
          wattage: spec.wattage,
          btuOutput: spec.wattage * 3.41,
          parentRackId: placement.rackId,
          slotIndex: placement.slotIndex,
          catalogKey: key,
          ports: [],
        }

        get().addNode(node)
        return true
      },

      setSelectedNode: (id) => set({ selectedNodeId: id, cableMode: false, connectingPort: null }),

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
            bandwidthGbps: Math.floor(Math.random() * 100) + 10, // 10 to 110 Gbps
            latencyMs: Math.random() > 0.7 ? Math.floor(Math.random() * 40) + 11 : Math.floor(Math.random() * 9) + 1, // 30% chance of >10ms latency
          }

          set((state) => ({
            connections: [...state.connections, newConnection],
            cableMode: false,
            connectingPort: null,
          }))
        }
      },

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
        
        // Recalculate if updating rack parameters (like max power) or moving node
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
    }
  )
)