import { describe, it, expect, beforeEach } from 'vitest'
import { useInfraStore } from '../store/useInfraStore'

describe('v1.3 Terminal Kernel - Command & ANSI Logic', () => {
  beforeEach(() => {
    useInfraStore.getState().resetCareer()
    // Add nodes for networking tests
    useInfraStore.getState().addNode({
       id: 'node-vlan-10',
       siteId: 'site-1',
       name: 'Switch-Core-10',
       type: 'compute', // using compute as placeholder for generic node
       ports: [{ id: 'eth0', type: 'copper', status: 'up', ip: '10.0.0.1' }],
       isConfigured: true,
       degradation: 0, price: 0, runningCosts: 0
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
    
    // Check for [[GREEN]]up or [[RED]]down
    const hasGreen = logs.some(l => l.includes('[[GREEN]]up'))
    const hasRed = logs.some(l => l.includes('[[RED]]down'))
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

    // Bootstrap: Set IP manually
    updateNode(targetNode.id, { ports: [{ id: 'eth0', type: 'copper', status: 'up', ip: targetIP }] })
    
    // Test B: Success SSH
    processCommand(`ssh ${targetIP}`)
    state = useInfraStore.getState().terminalStates['site-1']
    lastLog = state.sessions[0].panes[0].logs.slice(-1)[0]
    expect(lastLog).toContain('Last login')
    expect(state.sessions[0].panes[0].context.mode).toBe('ssh')
  })
})
