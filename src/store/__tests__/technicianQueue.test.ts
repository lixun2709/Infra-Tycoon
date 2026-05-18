import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useInfraStore } from '../useInfraStore'
import { Vector3 } from 'three'

// Mock three
vi.mock('three', () => ({
  Vector3: class {
    x: number; y: number; z: number;
    constructor(x=0, y=0, z=0) { this.x = x; this.y = y; this.z = z; }
  }
}))

describe('Technician RMA Queue & Maintenance Mode', () => {
  beforeEach(() => {
    useInfraStore.getState().resetState()
    useInfraStore.setState({
      balance: 10000,
      technicianTickets: [],
      nodes: [
        {
          id: 'server-1',
          type: 'compute',
          siteId: 'site-1',
          position: new Vector3(0, 0, 0),
          name: 'Core Server 01',
          uHeight: 1,
          wattage: 500,
          btuOutput: 1500,
          ports: [],
          services: [],
          systemState: 'running',
          bootProgress: 100,
          provisioningState: 'provisioned',
          installDate: 0,
          degradation: 45,
          healthStatus: 'degraded',
          maintenanceMode: false
        }
      ]
    })
  })

  it('should toggle maintenance mode on a node', () => {
    const { toggleMaintenanceMode } = useInfraStore.getState()
    
    // Toggle ON
    toggleMaintenanceMode('server-1')
    expect(useInfraStore.getState().nodes[0]!.maintenanceMode).toBe(true)

    // Toggle OFF
    toggleMaintenanceMode('server-1')
    expect(useInfraStore.getState().nodes[0]!.maintenanceMode).toBe(false)
  })

  it('should register a technician ticket and deduct cost', () => {
    const { repairHardware } = useInfraStore.getState()

    repairHardware('server-1')

    const state = useInfraStore.getState()
    expect(state.balance).toBe(8500) // $10,000 - $1,500 cost
    expect(state.technicianTickets).toHaveLength(1)
    
    const ticket = state.technicianTickets[0]!
    expect(ticket.nodeId).toBe('server-1')
    expect(ticket.status).toBe('dispatched')
    expect(ticket.totalSeconds).toBe(20)
    expect(ticket.cost).toBe(1500)
    
    // Server should be automatically put in maintenanceMode
    expect(state.nodes[0]!.maintenanceMode).toBe(true)
  })

  it('should not dispatch ticket if insufficient balance', () => {
    useInfraStore.setState({ balance: 500 })
    const { repairHardware } = useInfraStore.getState()

    repairHardware('server-1')

    const state = useInfraStore.getState()
    expect(state.balance).toBe(500)
    expect(state.technicianTickets).toHaveLength(0)
  })

  it('should advance technician ticket status and repair server health on tick completion', () => {
    const { repairHardware, processTick } = useInfraStore.getState()

    repairHardware('server-1')
    expect(useInfraStore.getState().technicianTickets[0]!.status).toBe('dispatched')

    // Tick 4 times (elapsed 4 / 20 = 20% -> arrived)
    for (let i = 0; i < 4; i++) {
      processTick()
    }
    expect(useInfraStore.getState().technicianTickets[0]!.status).toBe('arrived')

    // Tick 6 times (elapsed 10 / 20 = 50% -> diagnosing)
    for (let i = 0; i < 6; i++) {
      processTick()
    }
    expect(useInfraStore.getState().technicianTickets[0]!.status).toBe('diagnosing')

    // Tick 6 times (elapsed 16 / 20 = 80% -> repairing)
    for (let i = 0; i < 6; i++) {
      processTick()
    }
    expect(useInfraStore.getState().technicianTickets[0]!.status).toBe('repairing')

    // Tick remaining 4 times (elapsed 20 / 20 = 100% -> completed and removed)
    for (let i = 0; i < 4; i++) {
      processTick()
    }

    const state = useInfraStore.getState()
    expect(state.technicianTickets).toHaveLength(0) // Completed ticket is removed
    expect(state.nodes[0]!.healthStatus).toBe('healthy')
    expect(state.nodes[0]!.degradation).toBe(0)
    expect(state.nodes[0]!.maintenanceMode).toBe(false) // Safe release from maintenance mode
  })
})
