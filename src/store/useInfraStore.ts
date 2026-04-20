import { Vector3 } from 'three'
import { create } from 'zustand'
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
  /** Rack height in U, or device height in U (1–42 for racks). */
  uHeight: number
  /** Power draw of this node in watts (hardware nodes), or 0 for racks. */
  wattage: number
  /** Heat output of this node in BTU/hr. */
  btuOutput: number
  /** When set, this node is mounted in a rack. */
  parentRackId?: string
  /** Bottom-most U position (1 = bottom of rack); only for mounted gear. */
  slotIndex?: number
  catalogKey?: HardwareCatalogKey
  /** Rack-specific power capacity (kW). Default: 5.0. */
  maxPowerKW?: number
  /** Rack-specific current load (kW). */
  currentPowerKW?: number
  /** Rack-specific power status. */
  status?: RackStatus
  ports: HardwarePort[]
}

type InfraState = {
  nodes: InfraNode[]
  totalPowerKW: number
  totalRoomBTU: number
  overloadedRackCount: number
  selectedNodeId: string | null
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey) => boolean
  setSelectedNode: (id: string | null) => void
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
    })),
  )
}

export const useInfraStore = create<InfraState>((set, get) => ({
  nodes: [],
  totalPowerKW: 0,
  totalRoomBTU: 0,
  overloadedRackCount: 0,
  selectedNodeId: null,
  addNode: (node) => {
    const normalizedNode =
      node.catalogKey != null
        ? {
            ...node,
            ports: node.ports.length > 0 ? node.ports : createPortsForCatalog(node.id, node.catalogKey),
          }
        : node

    set((state) => ({
      nodes: [...state.nodes, normalizedNode],
    }))
    if (normalizedNode.type === 'rack') {
      calculateRackPower(normalizedNode.id)
    } else if (normalizedNode.parentRackId) {
      calculateRackPower(normalizedNode.parentRackId)
    }
    recalculateRoomStats()
  },
  placeCatalogHardware: (key) => {
    const spec = HARDWARE_CATALOG[key]
    const placement = findFirstEmptySlot(get().nodes, spec.uHeight)
    if (!placement) return false

    const rack = get().nodes.find((n) => n.id === placement.rackId)
    if (!rack) return false

    const node: InfraNode = {
      id: crypto.randomUUID(),
      type: spec.type,
      name: catalogDisplayName[key],
      position: rack.position.clone(),
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
  setSelectedNode: (id) => {
    set({ selectedNodeId: id })
  },
}))
