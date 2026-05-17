import { describe, it, expect, vi } from 'vitest'
import { handleCommand } from '../store/terminalLogic'
import type { InfraState } from '../store/infraStoreTypes'
import type { TerminalStateRecord } from '../store/terminalTypes'

describe('FileSystem Simulation', () => {
  const getMockState = (): Partial<InfraState> => {
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
      storedFiles: {
        '/etc/hosts': '127.0.0.1 localhost'
      }
    }

    return {
      currentSiteId: 'site-1',
      terminalStates: {
        'site-1': mockTerminalState
      },
      nodes: [],
      balance: 1000,
      dnsRecords: []
    }
  }

  it('should list root directory', async () => {
    const mockGet = getMockState
    const mockSet = vi.fn()
    
    await handleCommand(mockGet as unknown as () => InfraState, mockSet, 'ls')
    
    expect(mockSet).toHaveBeenCalled()
  })

  it('should navigate directories', async () => {
    const mockGet = getMockState
    const mockSet = vi.fn()
    
    await handleCommand(mockGet as unknown as () => InfraState, mockSet, 'cd etc')
    expect(mockSet).toHaveBeenCalled()
  })
})
