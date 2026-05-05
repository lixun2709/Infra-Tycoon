import { describe, it, expect, beforeEach } from 'vitest'
import { useInfraStore } from '../store/useInfraStore'

describe('v1.3 Terminal Kernel - File System & Scripting', () => {
  beforeEach(() => {
    useInfraStore.getState().resetState()
    // Add nodes for scripting tests
    useInfraStore.getState().addNode({
       id: 'node-1', 
       siteId: 'site-1', 
       name: 'Node-1', 
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

  it('should support nano editor file creation and cat verification', () => {
    const { writeTerminalFile, processCommand } = useInfraStore.getState()
    const path = '/etc/test_config.conf'
    const content = "DOMAIN=infra.local\nRETRY=5\nDEBUG=true"
    
    // Simulate nano save
    writeTerminalFile(path, content)
    
    // Verify with cat
    processCommand(`cat ${path}`)
    const state = useInfraStore.getState().terminalStates['site-1']
    const logs = state.sessions[0].panes[0].logs
    
    expect(logs).toContain('DOMAIN=infra.local')
    expect(logs).toContain('RETRY=5')
    expect(logs).toContain('DEBUG=true')
  })

  it('should execute shell scripts and update infrastructure state', async () => {
    const { writeTerminalFile, processCommand } = useInfraStore.getState()
    const scriptPath = 'provision.sh'
    const targetIP = '192.168.1.50'
    // const targetNodeId = nodes[0].id
    
    // Script that exports a var, echos it, and would normally do more
    const scriptContent = [
      `export MGMT_IP=${targetIP}`,
      `echo "Provisioning $MGMT_IP..."`,
      `alias check_health="cluster health show"`
    ].join('\n')
    
    writeTerminalFile(scriptPath, scriptContent)
    
    // Execute script
    processCommand(`sh ${scriptPath}`)
    
    // Wait for the setTimeout in 'sh' implementation
    await new Promise(r => setTimeout(r, 200))
    
    const state = useInfraStore.getState().terminalStates['site-1']
    expect(state.envVars['MGMT_IP']).toBe(targetIP)
    expect(state.aliases['check_health']).toBe('cluster health show')
    
    const logs = state.sessions[0].panes[0].logs
    expect(logs.some(l => l.includes(`Provisioning ${targetIP}`))).toBe(true)
  })
})
