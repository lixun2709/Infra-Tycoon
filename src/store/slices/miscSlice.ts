import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { audioManager } from '../../utils/AudioManager'
import type { DnsRecord, Site, Blueprint } from '../infraTypes'

export interface MiscSlice {
  processAging: (dt: number) => void
  refreshHardware: (nodeId: string) => void
  repairHardware: (nodeId: string) => void
  toggleMaintenanceMode: (nodeId: string) => void
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
  getNetworkRoute: (startId: string, endId: string) => { exists: boolean; path: string[]; latencyMs: number; packetLoss: number; hops: number }
  resetState: () => void
  fixState: () => void
  updateSite: (id: string, updates: Partial<Site>) => void
  simulateRandomFailure: () => void
  simulateDataCorruption: () => void
  generateFinalReport: () => { score: number, grade: string, breakdown: unknown }
  checkAllCompliance: () => void
  finalRemoveNode: (id: string) => void
  visualizePath: (startId: string, endId: string) => void
  exportToTerraform: () => string
  runComplianceCheck: () => { type: 'error' | 'warning'; message: string }[]
  setPreviewBlueprint: (id: string | null) => void
  triggerDisasterRecoveryDrill: (siteId: string) => void
  triggerHVACFailureDrill: (siteId: string) => void
}

export const createMiscSlice: StateCreator<InfraState, [], [], MiscSlice> = (set, get) => ({
  processAging: (dt: number) => {
    const { nodes } = get()
    const updatedNodes = nodes.map(node => {
      if (node.type === 'rack' || node.type === 'cooling') return node
      // dt is in real-world seconds. Let's say 1 hour of gameplay (3600s) = 1 in-game month.
      // We want hardware to degrade 10% per month, so 10% per 3600 seconds.
      // 10 / 3600 = 0.0027% per second.
      const degradationRatePerSecond = 10 / 3600 
      const newDegradation = Math.min(100, (node.degradation || 0) + (degradationRatePerSecond * dt))
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
      nodes: state.nodes.map(n => n.id === nodeId ? { 
        ...n, 
        degradation: 0, 
        driveDegradation: 0,
        storageStatus: n.storageStatus === 'failed' || n.storageStatus === 'degraded' ? 'rebuilding' : n.storageStatus,
        rebuildProgress: 0,
        lastMaintenance: Date.now() 
      } : n)
    }))
    pushAlert('info', `Hardware refreshed for $${cost.toLocaleString()}`)
  },

  repairHardware: (nodeId) => {
    const { balance, nodes, technicianTickets, pushAlert } = get()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const cost = 1500
    if (balance < cost) {
      pushAlert('warning', 'RMA Dispatch Blocked: Insufficient CapEx funds to schedule hardware repair.')
      audioManager.playEffect('error')
      return
    }

    const hasTicket = technicianTickets.some(t => t.nodeId === nodeId)
    if (hasTicket) {
      pushAlert('warning', `RMA Dispatch Blocked: A technician ticket is already active for ${node.name}.`)
      return
    }

    let componentType: 'drive' | 'cpu' | 'motherboard' | 'psu' = 'cpu'
    if (node.type === 'storage' || (node.driveDegradation && node.driveDegradation > 0)) {
      componentType = 'drive'
    } else if (node.wattage > 1000) {
      componentType = 'psu'
    }

    const ticketId = `ticket-${Math.random().toString(36).substring(2, 11)}`
    const newTicket = {
      id: ticketId,
      nodeId,
      nodeName: node.name,
      type: componentType,
      status: 'dispatched' as const,
      elapsedSeconds: 0,
      totalSeconds: 20,
      cost,
      progress: 0
    }

    set(state => ({
      balance: state.balance - cost,
      technicianTickets: [...state.technicianTickets, newTicket],
      nodes: state.nodes.map(n => n.id === nodeId ? { ...n, maintenanceMode: true } : n)
    }))

    pushAlert('info', `RMA Ticket Scheduled: Technician dispatched for ${node.name}. Fee: $${cost.toLocaleString()}`)
    audioManager.playEffect('click')
  },

  toggleMaintenanceMode: (nodeId) => {
    const { nodes, pushAlert } = get()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const nextMode = !node.maintenanceMode

    set(state => ({
      nodes: state.nodes.map(n => n.id === nodeId ? { ...n, maintenanceMode: nextMode } : n)
    }))

    if (nextMode) {
      pushAlert('info', `Maintenance Mode Enabled: Safe operational drain initiated on ${node.name}. Workloads paused.`)
    } else {
      pushAlert('info', `Maintenance Mode Disabled: ${node.name} returned to high-availability pool.`)
    }
    audioManager.playEffect('click')
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
    if (!sw) {
      pushAlert('warning', 'Auto-patching requires at least one switch inside the rack.')
      return
    }
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
    return get().getNetworkRoute(startId, endId).exists
  },

  getNetworkRoute: (startId, endId) => {
    const { connections } = get()
    if (startId === endId) {
      return { exists: true, path: [startId], latencyMs: 0.0, packetLoss: 0.0, hops: 0 }
    }

    const dist = new Map<string, number>()
    const prev = new Map<string, { nodeId: string; connId: string }>()
    const visited = new Set<string>()

    dist.set(startId, 0)

    const nodeIds = new Set<string>()
    connections.forEach(c => {
      nodeIds.add(c.startNodeId)
      nodeIds.add(c.endNodeId)
    })

    while (true) {
      let u: string | null = null
      let minDist = Infinity

      nodeIds.forEach(nodeId => {
        if (!visited.has(nodeId)) {
          const d = dist.get(nodeId) ?? Infinity
          if (d < minDist) {
            minDist = d
            u = nodeId
          }
        }
      })

      if (u === null || minDist === Infinity) {
        break
      }

      if (u === endId) {
        break
      }

      visited.add(u)

      const adj = connections.filter(c => c.status !== 'blocked' && (c.startNodeId === u || c.endNodeId === u))
      for (const conn of adj) {
        const v = conn.startNodeId === u ? conn.endNodeId : conn.startNodeId
        if (visited.has(v)) continue

        const latency = conn.latencyMs ?? 1.0
        const loss = conn.packetLoss ?? 0.0
        const weight = latency * (1.0 + loss * 10.0)

        const alt = minDist + weight
        if (alt < (dist.get(v) ?? Infinity)) {
          dist.set(v, alt)
          prev.set(v, { nodeId: u, connId: conn.id })
        }
      }
    }

    if (!dist.has(endId) || dist.get(endId) === Infinity) {
      return { exists: false, path: [], latencyMs: 999.0, packetLoss: 1.0, hops: 0 }
    }

    const path: string[] = []
    const connIds: string[] = []
    let curr = endId
    while (curr !== startId) {
      const parent = prev.get(curr)
      if (!parent) break
      path.push(curr)
      connIds.push(parent.connId)
      curr = parent.nodeId
    }
    path.push(startId)
    path.reverse()
    connIds.reverse()

    let totalLatency = 0.0
    let compoundSuccessRate = 1.0

    connIds.forEach(connId => {
      const conn = connections.find(c => c.id === connId)
      if (conn) {
        totalLatency += conn.latencyMs ?? 1.0
        const loss = conn.packetLoss ?? 0.0
        compoundSuccessRate *= (1.0 - loss)
      }
    })

    const finalLoss = 1.0 - compoundSuccessRate

    return {
      exists: true,
      path,
      latencyMs: Number(totalLatency.toFixed(1)),
      packetLoss: Number(finalLoss.toFixed(4)),
      hops: connIds.length
    }
  },


  simulateRandomFailure: () => {
    const { nodes, pushAlert, updateNode } = get()
    const hardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
    if (hardware.length === 0) return
    
    const target = hardware[Math.floor(Math.random() * hardware.length)]
    if (!target) return
    updateNode(target.id, { healthStatus: 'critical' })
    pushAlert('critical', `Hardware Failure: ${target.name} is in a critical state!`, target.id)
  },

  simulateDataCorruption: () => {
    const { nodes, pushAlert, updateNode } = get()
    const storages = nodes.filter(n => (n.type === 'storage' || n.type === 'backup') && (n.totalStorageTB ?? 0) > 0)
    if (storages.length === 0) return

    const target = storages[Math.floor(Math.random() * storages.length)]
    if (!target) return
    if (target.isImmutable) {
      pushAlert('info', `Threat blocked on ${target.name} by Immutable Snapshots.`)
    } else {
      updateNode(target.id, { infectionState: 'infected' })
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

  triggerDisasterRecoveryDrill: (siteId: string) => {
    const { incidents, pushAlert, sites } = get()
    const site = sites.find(s => s.id === siteId)
    if (!site) return

    const activeDrill = incidents.find(i => i.siteId === siteId && i.type === 'drill' && !i.isResolved)
    if (activeDrill) {
      pushAlert('warning', `A Disaster Recovery Drill is already active for ${site.name}.`)
      return
    }

    const newIncident: import('../infraTypes').Incident = {
      id: `drill-${Date.now()}`,
      siteId,
      type: 'drill',
      severity: 'high',
      startTimestamp: Date.now(),
      affectedNodes: [],
      isResolved: false,
      elapsedSeconds: 0,
      rtoTargetSeconds: 120 // 2 minutes to recover
    }

    set({ incidents: [...incidents, newIncident] })
    pushAlert('critical', `DISASTER RECOVERY DRILL INITIATED: ${site.name} has been isolated from the network. RTO countdown started.`)
    audioManager.playEffect('alert')
  },

  triggerHVACFailureDrill: (siteId: string) => {
    const { incidents, pushAlert, sites } = get()
    const site = sites.find(s => s.id === siteId)
    if (!site) return

    const activeDrill = incidents.find(i => i.siteId === siteId && i.type === 'hvac_drill' && !i.isResolved)
    if (activeDrill) {
      pushAlert('warning', `An HVAC Failure Drill is already active for ${site.name}.`)
      return
    }

    const newIncident: import('../infraTypes').Incident = {
      id: `hvac-drill-${Date.now()}`,
      siteId,
      type: 'hvac_drill',
      severity: 'high',
      startTimestamp: Date.now(),
      affectedNodes: [],
      isResolved: false,
      elapsedSeconds: 0,
      rtoTargetSeconds: 180 // 3 minutes to survive/recover
    }

    set({ incidents: [...incidents, newIncident] })
    pushAlert('critical', `HVAC FAILURE DRILL INITIATED: CRAC units at ${site.name} have been taken offline. Monitor thermal levels!`)
    audioManager.playEffect('alert')
  },

  resetState: () => {
    if (confirm('Reset all infrastructure?')) {
      localStorage.removeItem('infra-storage')
      window.location.reload()
    }
  },

  fixState: () => {
    const { nodes, sites } = get()
    const fixedSites = sites.map((s, i) => ({ ...s, id: s.id || `site-${i + 1}` }))
    const defaultSiteId = fixedSites[0]?.id || 'site-1'
    const fixedNodes = nodes.map(n => ({ ...n, siteId: n.siteId || defaultSiteId }))
    set({ sites: fixedSites, nodes: fixedNodes })
  },

  updateSite: (id, updates) => set(state => ({
    sites: state.sites.map(s => s.id === id ? { ...s, ...updates } : s)
  }))
})
