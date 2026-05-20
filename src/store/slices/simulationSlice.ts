import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { simWorkerManager } from '../../simulation/SimulationWorkerManager'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'
import { audioManager } from '../../utils/AudioManager'
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
    const { nodes, applications, connections } = get()
    
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
            currentPowerKW: update.currentPowerKW
          } as InfraNode
        }
        return node
      })
    }

    const overloadedRackCount = payload.overloadedRackCount ?? 0
    const siteMetricsHistory = payload.siteMetricsHistory

    set({ 
      nodes: updatedNodes, 
      applications: updatedApps,
      connections: updatedConnections,
      sites: updatedSites,
      overloadedRackCount,
      siteMetricsHistory
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
    
    const { nodes, applications, connections, networkLoad } = get()
    simWorkerManager.init(nodes, applications, connections, networkLoad)

    // Start centralized non-React Simulation Engine run loop (Day 28)
    simulationCoordinator.start(1000)
  },

  processTick: (dt = 1.0) => {
    console.log('[MAIN THREAD NODES]', get().nodes.map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parentRackId: n.parentRackId,
      slotIndex: n.slotIndex
    })))
    // 0. Request Worker Tick (Asynchronous)
    simWorkerManager.syncInput(get().nodes, get().applications, get().connections, get().networkLoad)
    simWorkerManager.requestTick(dt)
    
    const { nodes, applications, activeContracts, realTimePlayedSeconds, balance, reputation } = get()

    // 1. Core Simulation Updates (Decoupled from UI)
    get().processAging()

    // 1.5. Asynchronous Technician RMA Ticket Tickers
    const { technicianTickets, pushAlert, updateNode } = get()
    if (technicianTickets.length > 0) {
      const nextTickets = technicianTickets.map(ticket => {
        const nextElapsed = ticket.elapsedSeconds + dt
        const pct = nextElapsed / ticket.totalSeconds
        let nextStatus = ticket.status
        if (pct >= 1.0) {
          nextStatus = 'completed' as const
        } else if (pct >= 0.7) {
          nextStatus = 'repairing' as const
        } else if (pct >= 0.4) {
          nextStatus = 'diagnosing' as const
        } else if (pct >= 0.15) {
          nextStatus = 'arrived' as const
        }
        return { ...ticket, elapsedSeconds: nextElapsed, status: nextStatus }
      })

      const completedTickets = nextTickets.filter(t => t.status === 'completed')
      const remainingTickets = nextTickets.filter(t => t.status !== 'completed')

      set({ technicianTickets: remainingTickets })

      completedTickets.forEach(ticket => {
        const n = get().nodes.find(item => item.id === ticket.nodeId)
        if (n) {
          updateNode(ticket.nodeId, {
            healthStatus: 'healthy',
            degradation: 0,
            driveDegradation: 0,
            storageStatus: n.storageStatus === 'failed' || n.storageStatus === 'degraded' ? 'rebuilding' : n.storageStatus,
            rebuildProgress: 0,
            maintenanceMode: false,
            lastMaintenance: Date.now()
          })
          pushAlert('info', `RMA Completed: Technician successfully repaired and certified ${ticket.nodeName}!`)
          audioManager.playEffect('success')
        }
      })
    }

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

      // Check requirements
      let isHealthy = true
      blueprint.requirements.forEach(req => {
        const runningApps = applications.filter(a => {
          if (a.appId !== req.appId || a.status !== 'running') return false
          const parentNode = nodes.find(n => n.id === a.nodeId)
          return parentNode ? !parentNode.maintenanceMode : true
        })
        if (runningApps.length < req.count) isHealthy = false
      })

      const newAccumulatedPenalty = isHealthy 
        ? contract.accumulatedPenalty 
        : contract.accumulatedPenalty + (blueprint.penaltyPerTick * dt)

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
