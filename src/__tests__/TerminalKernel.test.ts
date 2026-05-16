import { describe, it, expect, vi } from 'vitest'
import { handleCommand } from '../store/terminalLogic'
import type { InfraState } from '../store/infraStoreTypes'
import type { SystemState } from '../store/infraTypes'

describe('Terminal Kernel v2', () => {
  it('should process basic commands', async () => {
    const mockGet = () => ({
      currentSiteId: 'site-1',
      terminalStates: {
        'site-1': { sessions: [{ id: 's1', history: [], cwd: '/' }] }
      },
      nodes: [],
      balance: 1000
    })
    const mockSet = vi.fn()
    
    await handleCommand(mockGet as unknown as () => InfraState, mockSet, 'help')
    expect(mockSet).toHaveBeenCalled()
  })

  it('should handle multi-argument commands', async () => {
    const mockGet = () => ({
      currentSiteId: 'site-1',
      terminalStates: {
        'site-1': { sessions: [{ id: 's1', history: [], cwd: '/' }] }
      },
      nodes: [{ id: 'node-1', name: 'srv-01', systemState: 'off' as SystemState }]
    })
    const mockSet = vi.fn()
    
    await handleCommand(mockGet as unknown as () => InfraState, mockSet, 'poweron node-1')
    expect(mockSet).toHaveBeenCalled()
  })
})
