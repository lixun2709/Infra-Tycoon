import { describe, it, expect, beforeEach } from 'vitest'
import { useInfraStore } from '../store/useInfraStore'

describe('v1.3 Terminal Kernel - Store & Persistence', () => {
  beforeEach(() => {
    useInfraStore.getState().resetState()
    // Add a node for testing
    useInfraStore.getState().addNode({
      id: 'node-1',
      siteId: 'site-1',
      name: 'Test-Compute-01',
      type: 'compute',
      ports: [],
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

  it('should maintain chronological history persistence', () => {
    const store = useInfraStore.getState()
    store.processCommand('ls')
    store.processCommand('pwd')
    
    const siteState = useInfraStore.getState().terminalStates['site-1']
    const activeSession = siteState.sessions.find(s => s.id === siteState.activeSessionId)!
    const activePane = activeSession.panes.find(p => p.id === activeSession.activePaneId)!
    
    expect(activePane.history).toContain('ls')
    expect(activePane.history).toContain('pwd')
    expect(activePane.history[activePane.history.length - 1]).toBe('pwd')
  })

  it('should manage independent sessions and splits', () => {
    const { addTerminalSession, splitTerminalPane, setActiveSession } = useInfraStore.getState()
    
    // Create 3 tabs
    addTerminalSession('Tab 2')
    addTerminalSession('Tab 3')
    
    const state = useInfraStore.getState().terminalStates['site-1']
    expect(state.sessions.length).toBe(3)
    
    // Split pane in active tab
    splitTerminalPane('vertical')
    const stateWithSplit = useInfraStore.getState().terminalStates['site-1']
    const activeSession = stateWithSplit.sessions.find(s => s.id === stateWithSplit.activeSessionId)!
    expect(activeSession.panes.length).toBe(2)
    
    // Verify independent history
    // After addTerminalSession x2, sessions[2] is active.
    // splitTerminalPane adds a second pane and focuses it.
    useInfraStore.getState().processCommand('echo session_active')
    
    // Switch to first session (sessions[0])
    const firstSessionId = stateWithSplit.sessions[0].id
    setActiveSession(firstSessionId)
    useInfraStore.getState().processCommand('echo session_first')
    
    const finalState = useInfraStore.getState().terminalStates['site-1']
    const session2 = finalState.sessions[2]
    const activePaneInS2 = session2.panes.find(p => p.id === session2.activePaneId)!
    
    expect(activePaneInS2.history).toContain('echo session_active')
    expect(finalState.sessions[0].panes[0].history).toContain('echo session_first')
    expect(finalState.sessions[0].panes[0].history).not.toContain('echo session_active')
  })

  it('should support environment variables in command execution', async () => {
    useInfraStore.getState().processCommand('export TEST_VAR=infra_123')
    // Wait a tiny bit for state merge
    await new Promise(r => setTimeout(r, 50))
    
    const state = useInfraStore.getState().terminalStates['site-1']
    expect(state.envVars['TEST_VAR']).toBe('infra_123')
  })
})
