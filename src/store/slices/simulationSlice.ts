import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { simWorkerManager } from '../../simulation/SimulationWorkerManager'
import { calculateRackPower, recalculateRoomStats } from '../../physics/powerEngine'
import type { InfraNode, ApplicationDeployment } from '../infraTypes'
import type { SimSyncOutputPayload, SimTelemetryPayload } from '../../simulation/worker/workerTypes'
import { simulationCoordinator } from '../../simulation/SimulationCoordinator'
import { useMissionStore } from '../useMissionStore'

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
    const newPostMortems: import('../infraTypes').PostMortem[] = []
    if (payload.incidents) {
      updatedIncidents = get().incidents.map(incident => {
        const update = payload.incidents!.find(i => i.id === incident.id)
        if (update) {
          if (!incident.isResolved && update.isResolved) {
             newPostMortems.push({
               id: crypto.randomUUID(),
               incidentNumber: get().postMortems.length + newPostMortems.length + 1,
               timestamp: update.resolvedTimestamp || Date.now(),
               nodeName: 'Affected Nodes: ' + update.affectedNodes.length,
               nodeId: update.siteId,
               rca: `Root cause analysis for ${update.type.toUpperCase()}`,
               mitigation: `Drill concluded or incident recovered.`,
               impact: `Severity: ${update.severity.toUpperCase()}. Elapsed: ${update.elapsedSeconds}s (Target RTO: ${update.rtoTargetSeconds}s).`
             })
          }
          return { ...incident, ...update }
        }
        return incident
      })
      
      const newFromWorker = payload.incidents.filter(pi => !get().incidents.find(i => i.id === pi.id))
      updatedIncidents = [...updatedIncidents, ...newFromWorker]
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
      postMortems: [...get().postMortems, ...newPostMortems],
      overloadedRackCount,
      siteMetricsHistory,
      totalPowerKW,
      totalRoomBTU
    })

    if (payload.firedAutomationPolicies && payload.firedAutomationPolicies.length > 0) {
      let updatedPolicies = get().automationPolicies
      let changed = false
      payload.firedAutomationPolicies.forEach(fired => {
        const idx = updatedPolicies.findIndex(p => p.id === fired.id)
        if (idx !== -1) {
          updatedPolicies = [...updatedPolicies]
          updatedPolicies[idx] = { ...updatedPolicies[idx], lastFiredAt: fired.firedAt } as import('../infraTypes').AutomationPolicy
          changed = true
        }
      })
      if (changed) {
        set({ automationPolicies: updatedPolicies })
      }
    }

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
    
    const { nodes, applications, virtualMachines, connections, activeContracts, networkLoad, technicianTickets, incidents, automationPolicies } = get()
    simWorkerManager.init(nodes, applications, virtualMachines, connections, activeContracts, [], networkLoad, technicianTickets, incidents, automationPolicies, get().globalTargetFirmware)

    get().refreshMarketContracts()

    // Start centralized non-React Simulation Engine run loop (Day 28)
    simulationCoordinator.start(1000)
  },

  processTick: (dt = 1.0) => {
    // 0. Request Worker Tick (Asynchronous)
    simWorkerManager.syncInput(get().nodes, get().applications, get().virtualMachines, get().connections, get().activeContracts, [], get().networkLoad, get().technicianTickets, get().incidents, get().automationPolicies, get().globalTargetFirmware)
    simWorkerManager.requestTick(dt)
    
    const { nodes } = get()

    // 1. Core Simulation Updates (Decoupled from UI)
    get().processAging(dt)

    // 2. SLA, Contract Management, & Operational Expenses
    get().processEconomyTick(dt)

    // 3. Recalculate Facilities
    recalculateRoomStats()
    nodes.filter(n => n.type === 'rack').forEach(r => calculateRackPower(nodes, r.id))

    // 4. Evaluate Missions (outside UI render cycle)
    useMissionStore.getState().evaluateActiveMission(get())
  }
})
