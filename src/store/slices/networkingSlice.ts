import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { audioManager } from '../../utils/AudioManager'
import type { Connection, ServiceType } from '../infraTypes'

export interface NetworkingSlice {
  handlePortClick: (nodeId: string, portId: string) => void
  removeConnection: (id: string) => void
  patchConnection: (sNodeId: string, sPortId: string, tNodeId: string, tPortId: string) => void
  verifyService: (nodeId: string, type: ServiceType) => boolean
  getServiceStatus: (type: ServiceType) => 'green' | 'red'
  ping: (sourceId: string, targetIp: string) => { success: boolean; message: string }
  addReplicationLink: (sourceId: string) => void
  validateReplication: (linkId: string) => boolean
}

export const createNetworkingSlice: StateCreator<InfraState, [], [], NetworkingSlice> = (set, get) => ({
  handlePortClick: (nodeId, portId) => {
    const { patchingActive, activePatchSource } = get()
    
    if (!patchingActive) {
      set({ patchingActive: true, activePatchSource: { nodeId, portId } })
      audioManager.playEffect('alert')
      return
    }

    if (activePatchSource?.nodeId === nodeId && activePatchSource?.portId === portId) {
      set({ patchingActive: false, activePatchSource: null })
      return
    }

    // Attempt patch
    get().patchConnection(activePatchSource!.nodeId, activePatchSource!.portId, nodeId, portId)
    set({ patchingActive: false, activePatchSource: null })
  },

  patchConnection: (sNodeId, sPortId, tNodeId, tPortId) => {
    const { nodes, connections, pushAlert } = get()
    
    // Check if ports are already connected
    const existing = connections.find(c => 
      (c.startNodeId === sNodeId && c.startPortId === sPortId) ||
      (c.endNodeId === sNodeId && c.endPortId === sPortId) ||
      (c.startNodeId === tNodeId && c.startPortId === tPortId) ||
      (c.endNodeId === tNodeId && c.endPortId === tPortId)
    )

    if (existing) {
      pushAlert('warning', 'One or more ports are already connected.')
      return
    }

    const sNode = nodes.find(n => n.id === sNodeId)
    const tNode = nodes.find(n => n.id === tNodeId)
    const sPort = sNode?.ports.find(p => p.id === sPortId)
    const tPort = tNode?.ports.find(p => p.id === tPortId)

    if (!sPort || !tPort) {
      pushAlert('warning', 'Port not found. Cannot establish link.')
      return
    }

    // Enforce port type compatibility
    if (sPort.type !== tPort.type) {
      pushAlert('critical', `Incompatible Ports: Cannot connect a ${sPort.type.toUpperCase()} port to a ${tPort.type.toUpperCase()} port.`)
      return
    }

    // Set high-fidelity realistic capacity, latency, and characteristics based on connection type
    let bandwidthGbps = 10
    let latencyMs = 1
    if (sPort.type === 'fc') {
      bandwidthGbps = 16 // 16GFC Fiber Channel
      latencyMs = 0.2    // Ultra low latency optical transit
    } else if (sPort.type === 'sas') {
      bandwidthGbps = 12 // SAS-3 12Gb/s storage fabric
      latencyMs = 0.4    // Low-latency local storage bus
    } else if (sPort.type === 'power') {
      bandwidthGbps = 0  // Power delivery has no network transit bandwidth
      latencyMs = 0
    }

    const newConnection: Connection = {
      id: crypto.randomUUID(),
      startNodeId: sNodeId,
      startPortId: sPortId,
      endNodeId: tNodeId,
      endPortId: tPortId,
      status: 'active' as const,
      bandwidthGbps,
      throughputGbps: 0,
      latencyMs,
      type: sPort.type
    }

    const updatedNodes = nodes.map(n => {
      if (n.id === sNodeId || n.id === tNodeId) {
        return {
          ...n,
          ports: n.ports.map(p => {
            if ((n.id === sNodeId && p.id === sPortId) || (n.id === tNodeId && p.id === tPortId)) {
              return { ...p, connectedTo: n.id === sNodeId ? tNodeId : sNodeId, status: 'up' as const }
            }
            return p
          })
        }
      }
      return n
    })

    set({ connections: [...connections, newConnection], nodes: updatedNodes })
    audioManager.playEffect('success')
    
    const typeLabels: Record<string, string> = {
      power: 'C13 Power Feed',
      network: 'Ethernet Cat6 Copper',
      fc: 'OM4 Duplex LC Optical Fiber',
      sas: 'Mini-SAS HD Metallic Shielded'
    }
    const label = typeLabels[sPort.type] || 'Standard Interface'
    pushAlert('info', `Physical ${label} established between ${sNode?.hostname || sNodeId.slice(0,4)} and ${tNode?.hostname || tNodeId.slice(0,4)}`)
  },

  removeConnection: (id) => {
    const { connections, nodes } = get()
    const conn = connections.find(c => c.id === id)
    if (!conn) return

    const updatedNodes = nodes.map(n => {
      if (n.id === conn.startNodeId || n.id === conn.endNodeId) {
        return {
          ...n,
          ports: n.ports.map(p => {
            if (p.id === conn.startPortId || p.id === conn.endPortId) {
              return { ...p, connectedTo: null, status: 'down' as const }
            }
            return p
          })
        }
      }
      return n
    })

    set({ 
      connections: connections.filter(c => c.id !== id),
      nodes: updatedNodes
    })
  },

  verifyService: (nodeId, type) => {
    const { nodes } = get()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return false
    return node.services?.some(s => s.type === type && s.status === 'running') || false
  },

  getServiceStatus: (type) => {
    const { nodes } = get()
    const running = nodes.some(n => n.services?.some(s => s.type === type && s.status === 'running'))
    return running ? 'green' : 'red'
  },

  ping: (sourceId, targetIp) => {
    const { nodes, checkNetworkPath } = get()
    const targetNode = nodes.find(n => n.ports.some(p => p.ip === targetIp))
    
    if (!targetNode) return { success: false, message: 'Destination Host Unreachable' }
    
    const pathExists = checkNetworkPath(sourceId, targetNode.id)
    if (!pathExists) return { success: false, message: 'Request Timed Out' }

    return { success: true, message: `64 bytes from ${targetIp}: icmp_seq=1 ttl=64 time=1.02 ms` }
  },

  addReplicationLink: (sourceId) => {
    const { cloudLinks } = get()
    const newLink = {
      id: crypto.randomUUID(),
      nodeId: sourceId, // sourceId is used as nodeId here
      tieredTB: 0
    }
    set({ cloudLinks: [...cloudLinks, newLink] })
  },

  validateReplication: (linkId) => {
    const { cloudLinks } = get()
    return cloudLinks.some(l => l.id === linkId)
  }
})
