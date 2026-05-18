import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { simWorkerManager } from '../../simulation/SimulationWorkerManager'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'
import { calculateRackPower, recalculateRoomStats } from '../../physics/powerEngine'
import type { InfraNode, ApplicationDeployment } from '../infraTypes'
import type { SimSyncOutputPayload, SimTelemetryPayload } from '../../simulation/worker/workerTypes'
import { simulationCoordinator } from '../../simulation/SimulationCoordinator'
import { simulateNetwork } from '../../physics/network/simulation'

export interface SimulationSlice {
  processTick: () => void
  initializeSimulation: () => void
  handleWorkerOutput: (payload: SimSyncOutputPayload) => void
  getSimulationTelemetry: () => SimTelemetryPayload | null
}

export const createSimulationSlice: StateCreator<InfraState, [], [], SimulationSlice> = (set, get) => ({
  getSimulationTelemetry: () => {
    return (get() as InfraState & { _lastTelemetry?: SimTelemetryPayload })._lastTelemetry || null
  },

  handleWorkerOutput: (payload) => {
    const { nodes, applications } = get()
    
    // Update nodes with telemetry data
    const updatedNodes = nodes.map(node => {
      const update = payload.nodes.find(n => n.id === node.id)
      if (update) {
        return { ...node, ...update } as InfraNode
      }
      return node
    })

    // Update applications with status data
    const updatedApps = applications.map(app => {
      const update = payload.applications.find(a => a.id === app.id)
      if (update) {
        return { ...app, ...update as ApplicationDeployment }
      }
      return app
    })

    set({ 
      nodes: updatedNodes, 
      applications: updatedApps
    })
  },

  initializeSimulation: () => {
    console.log('[[Store]] Initializing Simulation Worker integration...')
    simWorkerManager.onOutput((payload) => get().handleWorkerOutput(payload))
    simWorkerManager.onTelemetry((telemetry) => {
      set({ _lastTelemetry: telemetry } as Partial<InfraState>)
    })
    
    const { nodes, applications } = get()
    simWorkerManager.init(nodes, applications)

    // Start centralized non-React Simulation Engine run loop (Day 28)
    simulationCoordinator.start(2000)
  },

  processTick: () => {
    // 0. Request Worker Tick (Asynchronous)
    simWorkerManager.syncInput(get().nodes, get().applications)
    simWorkerManager.requestTick()
    
    const { nodes, applications, activeContracts, simulationCycle, balance, reputation, networkLoad, connections } = get()

    // 1. Core Simulation Updates (Decoupled from UI)
    get().processAging()

    // Deterministic Network Simulation Pipeline (Day 31)
    const { connections: updatedConnections } = simulateNetwork(nodes, connections, networkLoad)
    set({ connections: updatedConnections })

    // 2. SLA & Contract Management
    const isMonthEnd = simulationCycle % 30 === 0 && simulationCycle > 0
    let monthlyRevenue = 0
    let monthlyPenalty = 0

    const updatedContracts = activeContracts.map(contract => {
      const blueprint = CONTRACT_CATALOG[contract.blueprintId]
      if (!blueprint) return contract

      // Check requirements
      let isHealthy = true
      blueprint.requirements.forEach(req => {
        const runningApps = applications.filter(a => a.appId === req.appId && a.status === 'running')
        if (runningApps.length < req.count) isHealthy = false
      })

      const newAccumulatedPenalty = isHealthy 
        ? contract.accumulatedPenalty 
        : contract.accumulatedPenalty + blueprint.penaltyPerTick

      if (isMonthEnd) {
        monthlyRevenue += blueprint.monthlyMRR
        monthlyPenalty += newAccumulatedPenalty
      }

      return {
        ...contract,
        totalTicks: contract.totalTicks + 1,
        uptimeTicks: isHealthy ? contract.uptimeTicks + 1 : contract.uptimeTicks,
        currentStatus: isHealthy ? 'healthy' as const : 'violating' as const,
        accumulatedPenalty: isMonthEnd ? 0 : newAccumulatedPenalty
      }
    })

    // 3. Operational Expenses
    const totalPowerKW = nodes.reduce((sum, n) => sum + (n.wattage || 0), 0) / 1000
    const powerCost = totalPowerKW * 0.12 // $0.12 per kWh equivalent per tick
    const rackRent = nodes.filter(n => n.type === 'rack').length * 50 // $50 per rack per tick

    const maintenanceCost = nodes.reduce((sum, n) => {
      if (n.type === 'rack') return sum
      const base = 10 // $10 base maintenance per node
      const stressMultiplier = n.isThrottled ? 2.5 : 1.0
      const ageMultiplier = 1 + (n.degradation / 100)
      return sum + (base * stressMultiplier * ageMultiplier)
    }, 0)

    // Hybrid Cloud Expenses
    const cloudCost = get().cloudBurstingActive ? (get().activeCloudInstances * 5) : 0
    const egressCost = get().cloudEgressGB * 0.1 // $0.10 per GB

    const totalExpenses = powerCost + rackRent + cloudCost + egressCost + maintenanceCost
    let newBalance = balance - totalExpenses

    if (isMonthEnd) {
      const netPayout = monthlyRevenue - monthlyPenalty
      newBalance += netPayout
      
      // Reputation adjustment
      const avgUptime = updatedContracts.length > 0 
        ? updatedContracts.reduce((sum, c) => sum + (c.uptimeTicks / c.totalTicks), 0) / updatedContracts.length 
        : 1.0
      
      const repChange = avgUptime > 0.99 ? 2 : avgUptime < 0.95 ? -5 : 0
      set({ reputation: Math.max(0, Math.min(100, reputation + repChange)) })

      get().pushAlert('info', `MONTHLY PAYOUT: $${netPayout.toLocaleString()} (Rev: $${monthlyRevenue}, Penalties: -$${monthlyPenalty})`)
    }

    // 4. State Update
    set({ 
      activeContracts: updatedContracts,
      balance: newBalance,
      simulationCycle: simulationCycle + 1
    })

    // Recalculate Facilities
    recalculateRoomStats()
    nodes.filter(n => n.type === 'rack').forEach(r => calculateRackPower(nodes, r.id))
  }
})
