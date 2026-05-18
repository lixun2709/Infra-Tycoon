import type { StateCreator } from 'zustand'
import { Vector3 } from 'three'
import type { InfraState } from '../infraStoreTypes'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import type { HardwareCatalogKey, HardwareCatalogSpec } from '../../physics/hardwareLibrary'
import { createPortsForCatalog } from '../infraInitialState'
import type { InfraNode, ServiceType, ServiceStatus } from '../infraTypes'
import { findFirstEmptySlot } from '../../physics/snapping'
import { ObservabilityTracer } from '../../simulation/observability/ObservabilityTracer'
import { audioManager } from '../../utils/AudioManager'

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
    const spanId = ObservabilityTracer.startSpan('hardware_procurement', undefined, { key, targetRackId })
    const { nodes, balance, pushAlert } = get()
    const spec = HARDWARE_CATALOG[key] as HardwareCatalogSpec
    if (!spec) {
      ObservabilityTracer.endSpan(spanId, 'failed')
      return false
    }

    if (balance < spec.purchasePrice) {
      pushAlert('warning', `Insufficient funds to procure ${spec.name}`)
      ObservabilityTracer.endSpan(spanId, 'failed')
      return false
    }

    const rack = nodes.find(n => n.id === targetRackId)
    if (!rack || rack.type !== 'rack') {
      ObservabilityTracer.endSpan(spanId, 'failed')
      return false
    }

    let slotIndex: number

    if (spec.isBlade) {
      const chassis = nodes.find(n => n.parentRackId === targetRackId && n.catalogKey === 'BLADE_CHASSIS_4U')
      if (!chassis) {
        pushAlert('warning', `Blade servers require a Blade Chassis to be placed in the rack.`)
        ObservabilityTracer.endSpan(spanId, 'failed')
        return false
      }
      slotIndex = chassis.slotIndex || 1
    } else {
      // Find empty slot (using snapping helper)
      const slot = findFirstEmptySlot(nodes, spec.uHeight, targetRackId)
      if (!slot || slot.rackId !== targetRackId) {
         pushAlert('warning', `No available ${spec.uHeight}U slot in target rack.`)
         ObservabilityTracer.endSpan(spanId, 'failed')
         return false
      }
      slotIndex = slot.slotIndex
    }

    const isStorage = spec.type === 'storage'
    const isCompute = spec.type === 'compute'
    const totalStorageTB = spec.storageTB || (isCompute ? 2 : 0)

    const newNode: InfraNode = {
      id: crypto.randomUUID(),
      name: `${spec.name} ${nodes.length + 1}`,
      type: spec.type,
      siteId: rack.siteId,
      position: new Vector3(0, 0, 0), // Placeholder, UI handles positioning
      parentRackId: targetRackId,
      slotIndex,
      uHeight: spec.uHeight,
      wattage: spec.wattage,
      btuOutput: spec.btuOutput || (spec.wattage * 3.41),
      catalogKey: key,
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
      installDate: Date.now(),
      totalStorageTB,
      usedStorageTB: 0,
      raidLevel: isStorage ? 'RAID5' : isCompute ? 'RAID0' : undefined,
      storageStatus: isStorage || isCompute ? 'healthy' : undefined,
      rebuildProgress: isStorage || isCompute ? 0 : undefined,
      ioPSLimit: isStorage ? 15000 : isCompute ? 5000 : undefined,
      ioPSUsed: isStorage || isCompute ? 0 : undefined,
      driveDegradation: isStorage || isCompute ? 0 : undefined
    }

    set(state => ({
      nodes: [...state.nodes, newNode],
      balance: state.balance - spec.purchasePrice,
      deploymentQueue: state.deploymentQueue.filter((_, i) => i !== state.deploymentQueue.indexOf(key))
    }))

    pushAlert('info', `Procured ${spec.name} for $${spec.purchasePrice.toLocaleString()}`)
    ObservabilityTracer.endSpan(spanId, 'success', { nodeId: newNode.id })
    return true
  },

  advanceProvisioningState: (id) => {
    const { nodes, connections, updateNode, pushAlert } = get()
    const node = nodes.find(n => n.id === id)
    if (!node || node.provisioningState === 'provisioned') return

    const currentState = node.provisioningState

    if (currentState === 'unboxed') {
      // 1. Unboxed -> Racked
      if (!node.parentRackId && node.type !== 'rack' && node.type !== 'cooling') {
        pushAlert('warning', `Mounting Required: Please mount ${node.name} inside a Server Rack before racking.`)
        audioManager.playEffect('error')
        return
      }
      updateNode(id, { provisioningState: 'racked', provisioningProgress: 25 })
      pushAlert('info', `Lifecycle: ${node.name} has been successfully racked.`)
      audioManager.playEffect('click')

    } else if (currentState === 'racked') {
      // 2. Racked -> Patched
      const hasConnections = connections.some(c => c.startNodeId === id || c.endNodeId === id)
      if (node.ports.length > 0 && !hasConnections) {
        pushAlert('warning', `Cabling Required: Please connect network/power cables to the ports of ${node.name} before patching.`)
        audioManager.playEffect('error')
        return
      }
      updateNode(id, { provisioningState: 'patched', provisioningProgress: 50 })
      pushAlert('info', `Lifecycle: ${node.name} cabled connections successfully patched.`)
      audioManager.playEffect('click')

    } else if (currentState === 'patched') {
      // 3. Patched -> Bootstrapped
      updateNode(id, { provisioningState: 'bootstrapped', provisioningProgress: 75 })
      pushAlert('info', `Lifecycle: ${node.name} successfully bootstrapped with base configurations.`)
      audioManager.playEffect('click')

    } else if (currentState === 'bootstrapped') {
      // 4. Bootstrapped -> Provisioned (Booting Sequence)
      updateNode(id, { 
        provisioningState: 'provisioned', 
        provisioningProgress: 100, 
        systemState: 'booting',
        bootProgress: 0 
      })
      pushAlert('info', `Lifecycle: ${node.name} fully provisioned! Boot sequence initiated.`)
      audioManager.playEffect('click')

      let progress = 0
      const interval = setInterval(() => {
        const currentNodes = get().nodes
        const n = currentNodes.find(item => item.id === id)
        if (!n || n.systemState !== 'booting') {
          clearInterval(interval)
          return
        }

        progress += 10
        updateNode(id, { bootProgress: progress })
        if (progress >= 100) {
          clearInterval(interval)
          updateNode(id, { systemState: 'running' })
          audioManager.playEffect('success')
        }
      }, 500)
    }
  },

  installService: (nodeId, type) => {
    const spanId = ObservabilityTracer.startSpan('service_installation', undefined, { nodeId, type })
    const { nodes, updateNode, pushAlert } = get()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) {
      ObservabilityTracer.endSpan(spanId, 'failed')
      return
    }

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
      ObservabilityTracer.endSpan(spanId, 'success', { serviceId: newService.id })
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
