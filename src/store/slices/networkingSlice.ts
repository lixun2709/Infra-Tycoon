import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { audioManager } from '../../utils/AudioManager'
import type { Connection, ServiceType } from '../infraTypes'

export interface NetworkingSlice {
  handlePortClick: (nodeId: string, portId: string) => void
  removeConnection: (id: string) => void
  patchConnection: (sNodeId: string, sPortId: string, tNodeId: string, tPortId: string) => void
  updateConnectionConfig: (id: string, config: Partial<Connection>) => void
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

    // 1. Calculate realistic physical distance
    const sRack = nodes.find(n => n.id === sNode?.parentRackId) || sNode
    const tRack = nodes.find(n => n.id === tNode?.parentRackId) || tNode
    
    let lengthMeters = 5.0
    if (sRack && tRack) {
      if (sRack.id === tRack.id) {
        // Intra-rack: vertical U distance + 1m slack
        const uDiff = Math.abs((sNode?.slotIndex || 0) - (tNode?.slotIndex || 0))
        lengthMeters = (uDiff * 0.05) + 1.0 
      } else {
        // Inter-rack: Manhattan distance across floor + up/down rack channels
        const manhattan = Math.abs(sRack.position.x - tRack.position.x) + Math.abs(sRack.position.z - tRack.position.z)
        lengthMeters = manhattan + 5.0 // 5m added for drop/climb from overhead tray
      }
    }

    // 2. Resolve media type, constraints and cost
    let mediaType: 'copper_cat6' | 'dac_twinax' | 'mmf_om4' | 'smf_os2' | 'power_c13' = 'copper_cat6'
    let costPerMeter = 2
    let maxLen = 100

    if (sPort.type === 'fc') {
      mediaType = 'mmf_om4'
      costPerMeter = 10
      maxLen = 300
    } else if (sPort.type === 'sas') {
      mediaType = 'dac_twinax'
      costPerMeter = 25
      maxLen = 5
    } else if (sPort.type === 'power') {
      mediaType = 'power_c13'
      costPerMeter = 5
      maxLen = 10
    } else if (sPort.type === 'network') {
       if (lengthMeters > 100) {
         mediaType = 'smf_os2'
         costPerMeter = 15
         maxLen = 10000
       }
    }

    // 3. Physics Check
    if (lengthMeters > maxLen) {
      pushAlert('critical', `PHYSICS LIMIT EXCEEDED: Cannot run ${mediaType} over ${Math.ceil(lengthMeters)}m! Max limit is ${maxLen}m.`)
      return
    }

    // 4. Financial Check
    const totalCost = lengthMeters * costPerMeter
    if (get().balance < totalCost) {
      pushAlert('warning', `Insufficient CapEx. Structured cabling run of ${Math.ceil(lengthMeters)}m costs $${Math.ceil(totalCost)}.`)
      return
    }

    // 5. Bandwidth and Latency simulation
    let bandwidthGbps = 10
    let baseLatency = 1
    if (sPort.type === 'fc') {
      bandwidthGbps = 16 
      baseLatency = 0.2    
    } else if (sPort.type === 'sas') {
      bandwidthGbps = 12 
      baseLatency = 0.4    
    } else if (sPort.type === 'power') {
      bandwidthGbps = 0  
      baseLatency = 0
    }

    const speedOfLightDelay = (lengthMeters / 200000) * 1000 // roughly 5us per km in fiber/copper
    const latencyMs = baseLatency + speedOfLightDelay

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
      type: sPort.type,
      lengthMeters,
      mediaType,
      cost: totalCost
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

    set({ 
      connections: [...connections, newConnection], 
      nodes: updatedNodes,
      balance: get().balance - totalCost 
    })
    
    audioManager.playEffect('success')
    
    const typeLabels: Record<string, string> = {
      power: 'C13 Power Feed',
      network: mediaType === 'smf_os2' ? 'OS2 Single-Mode Fiber' : 'Cat6 Copper',
      fc: 'OM4 Duplex LC Optical Fiber',
      sas: 'Mini-SAS HD DAC'
    }
    const label = typeLabels[sPort.type] || 'Standard Interface'
    pushAlert('info', `Physical run: ${label} (${Math.ceil(lengthMeters)}m) patched. CapEx: -$${Math.ceil(totalCost)}.`)
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

  updateConnectionConfig: (id, config) => {
    const { connections } = get()
    const updated = connections.map(c => c.id === id ? { ...c, ...config } : c)
    set({ connections: updated })
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
