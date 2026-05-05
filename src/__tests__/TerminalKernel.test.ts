import { describe, it, expect, beforeEach } from 'vitest'
import { useInfraStore } from '../store/useInfraStore'

describe('v1.3 Terminal Kernel - Command & ANSI Logic', () => {
  beforeEach(() => {
    useInfraStore.getState().resetState()
    // Add nodes for networking tests
    useInfraStore.getState().addNode({
       id: 'node-vlan-10',
       siteId: 'site-1',
       name: 'Switch-Core-10',
       type: 'compute', 
       ports: [{ id: 'eth0', type: 'network', status: 'up', label: 'eth0', connectedTo: null, ip: '10.0.0.1' }],
       isConfigured: true,
       degradation: 0,
       systemState: 'running',
       bootProgress: 100,
       provisioningState: 'bootstrapped',
       position: { x: 0, y: 0, z: 0 } as any,
       uHeight: 1,
       wattage: 300,
       btuOutput: 1000,
       services: [],
       installDate: 0
    })
  })

  it('should filter output correctly with grep pipe', () => {
    const { processCommand } = useInfraStore.getState()
    
    // Clear logs first to isolate the grep test
    processCommand('clear')
    processCommand('show vlan brief | grep 10')
    
    const state = useInfraStore.getState().terminalStates['site-1']
    const logs = state.sessions[0].panes[0].logs
    
    // Filters out matches. Command prompt (>) and Welcome message should be handled.
    const matches = logs.filter(l => !l.startsWith('>') && !l.toLowerCase().includes('ready') && !l.includes('VLAN'))
    matches.forEach(l => expect(l).toContain('10'))
    expect(matches.length).toBeGreaterThan(0)
  })

  it('should include ANSI color codes for networking status', () => {
    const { processCommand } = useInfraStore.getState()
    processCommand('show ip int brief')
    
    const state = useInfraStore.getState().terminalStates['site-1']
    const logs = state.sessions[0].panes[0].logs
    
    // Check for [[GREEN]]RUNNING or [[RED]]OFF
    const hasGreen = logs.some(l => l.includes('[[GREEN]]RUNNING'))
    const hasRed = logs.some(l => l.includes('[[RED]]OFF'))
    expect(hasGreen || hasRed).toBe(true)
  })

  it('should handle SSH connectivity bootstrap (Refused vs Success)', () => {
    const { processCommand, nodes, updateNode } = useInfraStore.getState()
    const targetNode = nodes.find(n => n.siteId === 'site-1' && n.type === 'compute')!
    const targetIP = '10.0.0.5'
    
    // Test A: Initial SSH (Refused because no IP set)
    processCommand(`ssh ${targetIP}`)
    let state = useInfraStore.getState().terminalStates['site-1']
    let lastLog = state.sessions[0].panes[0].logs.slice(-1)[0]
    expect(lastLog).toContain('Connection timed out') // or Refused

    // Bootstrap: Set IP manually, hostname, and establish OOB link
    updateNode(targetNode.id, { 
      hostname: 'node-01',
      managementIP: targetIP,
      systemState: 'running',
      ports: [{ id: 'eth0', type: 'network', status: 'up', label: 'eth0', connectedTo: null, ip: targetIP }] 
    })
    
    // Add a switch and connect to satisfy hasOobLink check
    const switchId = 'mgmt-switch'
    useInfraStore.getState().addNode({
       id: switchId, siteId: 'site-1', name: 'Mgmt-Switch', type: 'network', 
       ports: [{ id: 'p1', type: 'network', status: 'up', label: 'p1', connectedTo: null }],
       systemState: 'running', bootProgress: 100, provisioningState: 'bootstrapped',
       position: { x: 1, y: 0, z: 0 } as any, uHeight: 1, wattage: 50, btuOutput: 100, services: [], installDate: 0, degradation: 0
    })
    useInfraStore.setState(state => ({
      connections: [...state.connections, {
        id: 'conn-oob', startNodeId: targetNode.id, startPortId: 'eth0', endNodeId: switchId, endPortId: 'p1', status: 'active', bandwidthGbps: 1, throughputGbps: 0, latencyMs: 1
      }]
    }))
    
    // Test B: Success SSH
    processCommand(`ssh ${targetIP}`)
    state = useInfraStore.getState().terminalStates['site-1']
    lastLog = state.sessions[0].panes[0].logs.slice(-1)[0]
    expect(lastLog).toContain('Connection established')
    expect(state.sessions[0].panes[0].context.mode).toBe('ssh')
  })
})
