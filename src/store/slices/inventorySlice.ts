import type { StateCreator } from 'zustand'
import { Vector3 } from 'three'
import type { InfraState } from '../infraStoreTypes'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import type { HardwareCatalogKey, HardwareCatalogSpec } from '../../physics/hardwareLibrary'
import { createPortsForCatalog } from '../infraInitialState'
import type { InfraNode, ServiceType, ServiceStatus } from '../infraTypes'
import { findFirstEmptySlot } from '../../physics/snapping'

export interface InventorySlice {
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
  advanceProvisioningState: (id: string) => void
  installService: (nodeId: string, type: ServiceType) => void
  toggleService: (nodeId: string, serviceId: string, status: ServiceStatus) => void
}

export const createInventorySlice: StateCreator<InfraState, [], [], InventorySlice> = (set, get) => ({
  setPlacementMode: (mode, type = null) => set({ placementMode: mode, pendingRackType: type }),

  addNode: (node) => set(state => ({ nodes: [...state.nodes, node] })),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  updateNode: (id, updates) => set(state => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),

  removeNode: (id) => {
    const { nodes, connections, applications } = get()
    const nodeToRemove = nodes.find(n => n.id === id)
    if (!nodeToRemove) return

    // If it's a rack, remove all child nodes
    let nodesToRemove = [id]
    if (nodeToRemove.type === 'rack') {
      const children = nodes.filter(n => n.parentRackId === id).map(n => n.id)
      nodesToRemove = [...nodesToRemove, ...children]
    }

    set({
      nodes: nodes.filter(n => !nodesToRemove.includes(n.id)),
      connections: connections.filter(c => !nodesToRemove.includes(c.startNodeId) && !nodesToRemove.includes(c.endNodeId)),
      applications: applications.filter(a => !nodesToRemove.includes(a.nodeId))
    })
  },

  placeCatalogHardware: (key, targetRackId) => {
    const { nodes, balance, pushAlert } = get()
    const spec = HARDWARE_CATALOG[key] as HardwareCatalogSpec
    if (!spec) return false

    if (balance < spec.purchasePrice) {
      pushAlert('warning', `Insufficient funds to procure ${spec.name}`)
      return false
    }

    const rack = nodes.find(n => n.id === targetRackId)
    if (!rack || rack.type !== 'rack') return false

    // Find empty slot (using snapping helper)
    const slot = findFirstEmptySlot(nodes, spec.uHeight)
    if (!slot || slot.rackId !== targetRackId) {
       pushAlert('warning', `No available ${spec.uHeight}U slot in target rack.`)
       return false
    }

    const newNode: InfraNode = {
      id: crypto.randomUUID(),
      name: `${spec.name} ${nodes.length + 1}`,
      type: spec.type,
      siteId: rack.siteId,
      position: new Vector3(0, 0, 0), // Placeholder, UI handles positioning
      parentRackId: targetRackId,
      slotIndex: slot.slotIndex,
      uHeight: spec.uHeight,
      wattage: spec.wattage,
      btuOutput: spec.btuOutput || (spec.wattage * 3.41),
      provisioningState: 'unboxed',
      systemState: 'off',
      healthStatus: 'healthy',
      provisioningProgress: 0,
      ports: createPortsForCatalog(crypto.randomUUID(), key),
      services: [],
      temperature: 20,
      isThrottled: false,
      degradation: 0,
      lastMaintenance: Date.now(),
      bootProgress: 0,
      installDate: Date.now()
    }

    set(state => ({
      nodes: [...state.nodes, newNode],
      balance: state.balance - spec.purchasePrice,
      deploymentQueue: state.deploymentQueue.filter((_, i) => i !== state.deploymentQueue.indexOf(key))
    }))

    pushAlert('info', `Procured ${spec.name} for $${spec.purchasePrice.toLocaleString()}`)
    return true
  },

  advanceProvisioningState: (id) => {
    const { nodes, updateNode } = get()
    const node = nodes.find(n => n.id === id)
    if (!node || node.provisioningState === 'provisioned') return

    const nextProgress = (node.provisioningProgress ?? 0) + 20
    if (nextProgress >= 100) {
      updateNode(id, { provisioningState: 'provisioned', provisioningProgress: 100, systemState: 'booting' })
      setTimeout(() => updateNode(id, { systemState: 'running' }), 5000)
    } else {
      updateNode(id, { provisioningProgress: nextProgress })
    }
  },

  installService: (nodeId, type) => {
    const { nodes, updateNode, pushAlert } = get()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const newService = {
      id: crypto.randomUUID(),
      type,
      status: 'running' as const,
      port: 80
    }

    updateNode(nodeId, { services: [...(node.services || []), newService] })
    pushAlert('info', `Installing ${type} service on ${node.name}...`)
    
    setTimeout(() => {
      set(state => ({
        nodes: state.nodes.map(n => n.id === nodeId ? {
          ...n,
          services: n.services.map(s => s.id === newService.id ? { ...s, status: 'running' } : s)
        } : n)
      }))
    }, 3000)
  },

  toggleService: (nodeId, serviceId, status) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id === nodeId ? {
        ...n,
        services: n.services.map(s => s.id === serviceId ? { ...s, status } : s)
      } : n)
    }))
  }
})
