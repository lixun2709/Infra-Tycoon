import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { simWorkerManager } from '../../simulation/SimulationWorkerManager'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'
import { calculateRackPower, recalculateRoomStats } from '../../physics/powerEngine'
import type { InfraNode, ApplicationDeployment } from '../infraTypes'
import type { SimSyncOutputPayload, SimTelemetryPayload } from '../../simulation/worker/workerTypes'
import { simulationCoordinator } from '../../simulation/SimulationCoordinator'

export interface SimulationSlice {
  processTick: (dt?: number) => void
  initializeSimulation: () => void
  handleWorkerOutput: (payload: SimSyncOutputPayload) => void
  getSimulationTelemetry: () => SimTelemetryPayload | null
}

export const createSimulationSlice: StateCreator<InfraState, [], [], SimulationSlice> = (set, get) => ({
  getSimulationTelemetry: () => {
    return (get() as InfraState & { _lastTelemetry?: SimTelemetryPayload })._lastTelemetry || null
  },

  handleWorkerOutput: (payload) => {
    const { nodes, applications, virtualMachines, connections, activeContracts } = get()
    
    // Update nodes with telemetry data
    let updatedNodes = nodes.map(node => {
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

    // Update virtual machines with status and migration progress
    let updatedVMs = virtualMachines
    if (payload.virtualMachines) {
      updatedVMs = virtualMachines.map(vm => {
        const update = payload.virtualMachines!.find(v => v.id === vm.id)
        if (update) {
          return { ...vm, ...update }
        }
        return vm
      })
    }

    // Update cabled connection links asynchronously from worker output
    let updatedConnections = connections
    if (payload.connections) {
      updatedConnections = connections.map(conn => {
        const update = payload.connections.find(c => c.id === conn.id)
        if (update) {
          return { ...conn, ...update }
        }
        return conn
      })
    }

    // Update sites with localized ambient temperature updates
    const updatedSites = get().sites.map(site => {
      if (payload.siteAmbientTemps && payload.siteAmbientTemps[site.id] !== undefined) {
        return { ...site, ambientTemp: payload.siteAmbientTemps[site.id] }
      }
      return site
    })

    // Reconcile dynamic rack status and current power loads
    if (payload.racks && payload.racks.length > 0) {
      updatedNodes = updatedNodes.map(node => {
        const update = payload.racks!.find(r => r.id === node.id)
        if (update) {
          return {
            ...node,
            status: update.status,
            maxPowerKW: update.maxPowerKW,
            currentPowerKW: update.currentPowerKW,
            totalWeightKG: update.totalWeightKG,
            maxWeightKG: update.maxWeightKG
          } as InfraNode
        }
        return node
      })
    }

    const overloadedRackCount = payload.overloadedRackCount ?? 0
    const siteMetricsHistory = payload.siteMetricsHistory

    const currentSiteId = get().currentSiteId
    const siteRacks = updatedNodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId)
    const totalPowerKW = siteRacks.reduce((sum, r) => sum + (r.currentPowerKW || 0), 0)

    const chassisNodes = updatedNodes.filter(n => n.siteId === currentSiteId && n.type !== 'rack' && n.type !== 'cooling')
    const totalRoomBTU = Math.round(
      chassisNodes.reduce((sum, n) => {
        const isRunning = n.systemState === 'running'
        const isBooting = n.systemState === 'booting'
        let heat = 0.5
        if (isRunning) {
          heat = Math.max(10.0, (n.wattage || 300) * 3.412 * (1.1 - 0.9))
        } else if (isBooting) {
          heat = Math.max(10.0, (n.wattage || 300) * 0.5 * 3.412 * (1.1 - 0.9))
        }
        return sum + heat
      }, 0)
    )



    // Sync contracts from worker
    let updatedContractsStore = activeContracts
    if (payload.contracts) {
      updatedContractsStore = activeContracts.map(contract => {
        const update = payload.contracts!.find(c => c.id === contract.id)
        if (update) {
          return { ...contract, ...update }
        }
        return contract
      })
    }

    // Sync tickets and incidents from worker
    let updatedTickets = get().technicianTickets
    if (payload.tickets) {
      updatedTickets = get().technicianTickets.map(ticket => {
        const update = payload.tickets!.find(t => t.id === ticket.id)
        if (update) {
          return { ...ticket, ...update }
        }
        return ticket
      }).filter(t => t.status !== 'completed')
    }

    let updatedIncidents = get().incidents
    if (payload.incidents) {
      updatedIncidents = get().incidents.map(incident => {
        const update = payload.incidents!.find(i => i.id === incident.id)
        if (update) {
          return { ...incident, ...update }
        }
        return incident
      })
    }

    set({ 
      nodes: updatedNodes,
      applications: updatedApps,
      virtualMachines: updatedVMs,
      connections: updatedConnections,
      activeContracts: updatedContractsStore,
      sites: updatedSites,
      technicianTickets: updatedTickets,
      incidents: updatedIncidents,
      overloadedRackCount,
      siteMetricsHistory,
      totalPowerKW,
      totalRoomBTU
    })

    // Process background-fired alerts from the ObservabilitySystem
    if (payload.alerts && payload.alerts.length > 0) {
      payload.alerts.forEach(alert => {
        get().pushAlert(alert.severity, alert.message, alert.nodeId)
      })
    }
  },

  initializeSimulation: () => {
    console.log('[[Store]] Initializing Simulation Worker integration...')
    simWorkerManager.onOutput((payload) => get().handleWorkerOutput(payload))
    simWorkerManager.onTelemetry((telemetry) => {
      set({ _lastTelemetry: telemetry } as Partial<InfraState>)
    })
    
    const { nodes, applications, virtualMachines, connections, activeContracts, networkLoad, technicianTickets, incidents } = get()
    simWorkerManager.init(nodes, applications, virtualMachines, connections, activeContracts, [], networkLoad, technicianTickets, incidents)

    // Start centralized non-React Simulation Engine run loop (Day 28)
    simulationCoordinator.start(1000)
  },

  processTick: (dt = 1.0) => {
    // 0. Request Worker Tick (Asynchronous)
    simWorkerManager.syncInput(get().nodes, get().applications, get().virtualMachines, get().connections, get().activeContracts, [], get().networkLoad, get().technicianTickets, get().incidents)
    simWorkerManager.requestTick(dt)
    
    const { nodes, activeContracts, realTimePlayedSeconds, balance, reputation } = get()

    // 1. Core Simulation Updates (Decoupled from UI)
    get().processAging()

    // 2. SLA & Contract Management (Run billing accounting every 60 seconds of play time)
    const nextRealTimePlayedSeconds = realTimePlayedSeconds + dt
    const oldFloor = Math.floor(realTimePlayedSeconds / 60)
    const newFloor = Math.floor(nextRealTimePlayedSeconds / 60)
    const isMonthEnd = newFloor > oldFloor
    let monthlyRevenue = 0
    let monthlyPenalty = 0

    const updatedContracts = activeContracts.map(contract => {
      const blueprint = CONTRACT_CATALOG[contract.blueprintId]
      if (!blueprint) return contract

      // The ECS worker evaluates requirements exactly once per second,
      // tracking totalTicks, uptimeTicks, currentStatus, and accumulatedPenalty.
      // We only read these deterministically computed values here.

      if (isMonthEnd) {
        monthlyRevenue += blueprint.monthlyMRR
        monthlyPenalty += contract.accumulatedPenalty
        
        // Reset penalty upon monthly billing cycle
        return {
          ...contract,
          accumulatedPenalty: 0
        }
      }

      return contract
    })

    // 3. Operational Expenses
    const totalPowerKW = nodes.reduce((sum, n) => sum + (n.wattage || 0), 0) / 1000
    const powerCost = totalPowerKW * 0.12 * dt // $0.12 per kWh equivalent per second
    const rackRent = nodes.filter(n => n.type === 'rack').length * 50 * dt // $50 per rack per second

    const maintenanceCost = nodes.reduce((sum, n) => {
      if (n.type === 'rack') return sum
      const base = 10 // $10 base maintenance per node
      const stressMultiplier = n.isThrottled ? 2.5 : 1.0
      const ageMultiplier = 1 + (n.degradation / 100)
      return sum + (base * stressMultiplier * ageMultiplier * dt)
    }, 0)

    // Hybrid Cloud Expenses
    const cloudCost = get().cloudBurstingActive ? (get().activeCloudInstances * 5 * dt) : 0
    const egressCost = get().cloudEgressGB * 0.1 * dt // $0.10 per GB

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
      realTimePlayedSeconds: nextRealTimePlayedSeconds
    })

    // Recalculate Facilities
    recalculateRoomStats()
    nodes.filter(n => n.type === 'rack').forEach(r => calculateRackPower(nodes, r.id))
  }
})
