import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { audioManager } from '../../utils/AudioManager'
import type { DnsRecord, Site, Blueprint } from '../infraTypes'

export interface MiscSlice {
  processAging: () => void
  refreshHardware: (nodeId: string) => void
  repairHardware: (nodeId: string) => void
  setCloudBursting: (active: boolean) => void
  saveSiteAsBlueprint: (name: string) => void
  applyBlueprint: (id: string) => void
  addDnsRecord: (record: Omit<DnsRecord, 'id'>) => void
  removeDnsRecord: (id: string) => void
  autoPatchRack: (rackId: string) => void
  syncNtp: (nodeId: string) => void
  powerOnNode: (nodeId: string) => void
  setNodeHostname: (nodeId: string, name: string) => void
  assignNetworkDetails: () => void
  checkNetworkPath: (startId: string, endId: string) => boolean
  resetState: () => void
  fixState: () => void
  updateSite: (id: string, updates: Partial<Site>) => void
  processAutoBackups: () => void
  simulateRandomFailure: () => void
  simulateDataCorruption: () => void
  generateFinalReport: () => { score: number, grade: string, breakdown: unknown }
  checkAllCompliance: () => void
  finalRemoveNode: (id: string) => void
  visualizePath: (startId: string, endId: string) => void
  exportToTerraform: () => string
  runComplianceCheck: () => { type: 'error' | 'warning'; message: string }[]
  setPreviewBlueprint: (id: string | null) => void
}

export const createMiscSlice: StateCreator<InfraState, [], [], MiscSlice> = (set, get) => ({
  processAging: () => {
    const { nodes } = get()
    const updatedNodes = nodes.map(node => {
      if (node.type === 'rack') return node
      const lastMaint = node.lastMaintenance || Date.now()
      const age = (Date.now() - lastMaint) / (1000 * 60 * 60) // hours
      const newDegradation = Math.min(100, (node.degradation || 0) + (age * 0.1))
      return { ...node, degradation: newDegradation }
    })
    set({ nodes: updatedNodes })
  },

  refreshHardware: (nodeId) => {
    const { balance, pushAlert } = get()
    const cost = 5000
    if (balance < cost) {
      pushAlert('warning', 'Insufficient funds for hardware refresh.')
      return
    }
    set(state => ({
      balance: state.balance - cost,
      nodes: state.nodes.map(n => n.id === nodeId ? { ...n, degradation: 0, lastMaintenance: Date.now() } : n)
    }))
    pushAlert('info', `Hardware refreshed for $${cost.toLocaleString()}`)
  },

  repairHardware: (nodeId) => {
    const { balance, pushAlert } = get()
    const cost = 1500
    if (balance < cost) {
      pushAlert('warning', 'Insufficient funds for repair.')
      return
    }
    set(state => ({
      balance: state.balance - cost,
      nodes: state.nodes.map(n => n.id === nodeId ? { ...n, healthStatus: 'healthy' } : n)
    }))
    pushAlert('info', `Hardware repaired for $${cost.toLocaleString()}`)
  },

  setCloudBursting: (active) => set({ cloudBurstingActive: active }),

  saveSiteAsBlueprint: (name) => {
    const { nodes, connections, blueprints } = get()
    const newBlueprint: Blueprint = {
      id: crypto.randomUUID(),
      name,
      nodes: JSON.parse(JSON.stringify(nodes)),
      connections: JSON.parse(JSON.stringify(connections)),
      createdAt: Date.now()
    }
    set({ blueprints: [...blueprints, newBlueprint] })
    get().pushAlert('info', `Site saved as blueprint: ${name}`)
  },

  applyBlueprint: (id) => {
    const { blueprints, pushAlert } = get()
    const blueprint = blueprints.find(b => b.id === id)
    if (!blueprint) return
    
    set({ 
      nodes: JSON.parse(JSON.stringify(blueprint.nodes)), 
      connections: JSON.parse(JSON.stringify(blueprint.connections)) 
    })
    pushAlert('info', `Applied blueprint: ${blueprint.name}`)
  },

  addDnsRecord: (record) => set(state => ({ 
    dnsRecords: [...state.dnsRecords, { ...record, id: crypto.randomUUID() }] 
  })),

  removeDnsRecord: (id) => set(state => ({ 
    dnsRecords: state.dnsRecords.filter(r => r.id !== id) 
  })),

  autoPatchRack: (rackId) => {
    const { nodes, pushAlert } = get()
    const rackNodes = nodes.filter(n => n.parentRackId === rackId)
    const switches = rackNodes.filter(n => n.type === 'network')
    const servers = rackNodes.filter(n => n.type === 'compute' || n.type === 'storage')

    if (switches.length === 0 || servers.length === 0) {
      pushAlert('warning', 'Auto-patching requires at least one switch and one server in the rack.')
      return
    }

    const sw = switches[0]
    let patched = 0
    
    servers.forEach(srv => {
      const srvPort = srv.ports.find(p => p.type === 'network' && !p.connectedTo)
      const swPort = sw.ports.find(p => p.type === 'network' && !p.connectedTo)
      
      if (srvPort && swPort) {
        get().patchConnection(srv.id, srvPort.id, sw.id, swPort.id)
        patched++
      }
    })

    pushAlert('info', `Auto-patched ${patched} servers to ${sw.name}.`)
  },

  syncNtp: (nodeId) => {
    set(state => ({
      ntpSyncStatus: [
        ...state.ntpSyncStatus.filter(s => s.nodeId !== nodeId),
        { nodeId, offsetMs: Math.random() * 0.1, stratum: 2, status: 'synced' }
      ]
    }))
  },

  powerOnNode: (nodeId) => {
    const { updateNode } = get()
    updateNode(nodeId, { systemState: 'booting', bootProgress: 0 })
    
    let progress = 0
    const interval = setInterval(() => {
      // Check if node still exists and is booting
      const currentNodes = get().nodes
      const node = currentNodes.find(n => n.id === nodeId)
      if (!node || node.systemState !== 'booting') {
        clearInterval(interval)
        return
      }

      progress += 10
      updateNode(nodeId, { bootProgress: progress })
      if (progress >= 100) {
        clearInterval(interval)
        updateNode(nodeId, { systemState: 'running' })
        audioManager.playEffect('success')
      }
    }, 500)
  },

  setNodeHostname: (nodeId, name) => {
    get().updateNode(nodeId, { hostname: name })
  },

  assignNetworkDetails: () => {
    const { nodes, availableIPPool } = get()
    let poolIdx = 0
    const updatedNodes = nodes.map(node => {
      if (node.type === 'rack') return node
      const newPorts = node.ports.map(port => {
        if (port.type === 'network' && !port.ip && poolIdx < availableIPPool.length) {
          return { ...port, ip: availableIPPool[poolIdx++], mask: '255.255.255.0' }
        }
        return port
      })
      const mIP = node.managementIP || (poolIdx < availableIPPool.length ? availableIPPool[poolIdx++] : undefined)
      return { ...node, ports: newPorts, managementIP: mIP }
    })
    set({ nodes: updatedNodes })
  },

  checkNetworkPath: (startId, endId) => {
    const { connections } = get()
    if (startId === endId) return true

    const queue = [startId]
    const visited = new Set([startId])

    while (queue.length > 0) {
      const current = queue.shift()!
      const neighbors = connections
        .filter(c => c.startNodeId === current || c.endNodeId === current)
        .map(c => c.startNodeId === current ? c.endNodeId : c.startNodeId)

      for (const neighbor of neighbors) {
        if (neighbor === endId) return true
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    return false
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
      pushAlert('info', `Backup Cycle Complete: ${backedUpCount} nodes secured.`)
    }
  },

  simulateRandomFailure: () => {
    const { nodes, pushAlert, updateNode } = get()
    const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
    if (hardware.length === 0) return
    
    const target = hardware[Math.floor(Math.random() * hardware.length)]
    updateNode(target.id, { healthStatus: 'critical' })
    pushAlert('critical', `Hardware Failure: ${target.name} is in a critical state!`, target.id)
  },

  simulateDataCorruption: () => {
    const { nodes, pushAlert, updateNode } = get()
    const storages = nodes.filter(n => (n.type === 'storage' || n.type === 'backup') && (n.totalStorageTB ?? 0) > 0)
    if (storages.length === 0) return

    const target = storages[Math.floor(Math.random() * storages.length)]
    if (target.isImmutable) {
      pushAlert('info', `Threat blocked on ${target.name} by Immutable Snapshots.`)
    } else {
      updateNode(target.id, { isInfected: true })
      pushAlert('critical', `Data Corruption: ${target.name} infected by ransomware!`)
    }
  },

  generateFinalReport: () => {
    const { balance, reputation, nodes } = get()
    return {
      score: balance / 1000 + reputation * 10,
      grade: reputation > 90 ? 'S' : reputation > 80 ? 'A' : 'B',
      breakdown: { nodes: nodes.length }
    }
  },

  checkAllCompliance: () => {
    get().pushAlert('info', 'Running global compliance check...')
  },

  finalRemoveNode: (id) => get().removeNode(id),

  visualizePath: (startId, endId) => {
    get().pushAlert('info', `Visualizing network path from ${startId} to ${endId}...`)
  },

  exportToTerraform: () => `resource "infra_site" "DC" { ... }`,

  runComplianceCheck: () => [],

  setPreviewBlueprint: (id) => set({ previewBlueprintId: id }),

  resetState: () => {
    if (confirm('Reset all infrastructure?')) {
      localStorage.removeItem('infra-storage')
      window.location.reload()
    }
  },

  fixState: () => {
    const { nodes, sites } = get()
    const fixedSites = sites.map((s, i) => ({ ...s, id: s.id || `site-${i + 1}` }))
    const fixedNodes = nodes.map(n => ({ ...n, siteId: n.siteId || fixedSites[0].id }))
    set({ sites: fixedSites, nodes: fixedNodes })
  },

  updateSite: (id, updates) => set(state => ({
    sites: state.sites.map(s => s.id === id ? { ...s, ...updates } : s)
  }))
})
