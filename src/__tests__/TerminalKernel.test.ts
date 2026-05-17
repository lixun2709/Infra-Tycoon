import { describe, it, expect, vi } from 'vitest'
import { handleCommand } from '../store/terminalLogic'
import type { InfraState } from '../store/infraStoreTypes'
import type { SystemState, InfraNode } from '../store/infraTypes'
import type { TerminalStateRecord } from '../store/terminalTypes'

describe('Terminal Kernel v2', () => {
  const getMockState = (nodes: Partial<InfraNode>[] = []): Partial<InfraState> => {
    const mockTerminalState: TerminalStateRecord = {
      sessions: [
        {
          id: 's1',
          title: 'Session 1',
          panes: [
            {
              id: 'p1',
              logs: [],
              history: [],
              cwd: '/',
              context: {
                mode: 'global',
                targetId: null
              }
            }
          ],
          activePaneId: 'p1',
          layout: 'single'
        }
      ],
      activeSessionId: 's1',
      layout: {
        width: 600,
        height: 400,
        x: 100,
        y: 100,
        isMaximized: false
      },
      aliases: {},
      envVars: {},
      storedFiles: {}
    }

    return {
      currentSiteId: 'site-1',
      terminalStates: {
        'site-1': mockTerminalState
      },
      nodes: nodes as InfraNode[],
      balance: 1000,
      dnsRecords: []
    }
  }

  it('should process basic commands', async () => {
    const mockGet = () => getMockState()
    const mockSet = vi.fn()
    
    await handleCommand(mockGet as unknown as () => InfraState, mockSet, 'help')
    expect(mockSet).toHaveBeenCalled()
  })

  it('should handle multi-argument commands', async () => {
    const mockGet = () => getMockState([
      { id: 'node-1', name: 'srv-01', type: 'compute', systemState: 'off' as SystemState, ports: [], services: [] }
    ])
    const mockSet = vi.fn()
    
    await handleCommand(mockGet as unknown as () => InfraState, mockSet, 'poweron node-1')
    expect(mockSet).toHaveBeenCalled()
  })
})
