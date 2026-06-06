/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { InfraState } from './infraStoreTypes'
import { INITIAL_SITES, INITIAL_TERMINAL_STATE } from './infraInitialState'
import { createSimulationSlice } from './slices/simulationSlice'

import { createInventorySlice } from './slices/inventorySlice'
import { createTerminalSlice } from './slices/terminalSlice'
import { createContractSlice } from './slices/contractSlice'
import { createSaveSlice } from './slices/saveSlice'
import { createMiscSlice } from './slices/miscSlice'
import { createNetworkingSlice } from './slices/networkingSlice'
import { createAppSlice } from './slices/appSlice'
import { createCameraSlice } from './slices/cameraSlice'
import { createInteractionSlice } from './slices/interactionSlice'
import { createEconomySlice } from './slices/economySlice'
import { createProgressionSlice } from './slices/progressionSlice'
import { createStorageSlice } from './slices/storageSlice'
import { createAutomationSlice } from './slices/automationSlice'
import { createCloudSlice, getInitialCloudState } from './slices/cloudSlice'
import { createItsmSlice } from './slices/itsmSlice'
import { handleCommand } from './terminalLogic'
import { audioManager } from '../utils/AudioManager'
import { syncZoningWithStore } from '../physics/zoning'
import { useUIStore } from './useUIStore'

export const useInfraStore = create<InfraState>()(
  persist<InfraState, [], [], any>(
    (set, get, api) => ({
      // --- INITIAL STATE ---
      nodes: [],
      connections: [],
      cloudLinks: [],
      cloudEgressGB: 0,
      totalPowerKW: 0,
      totalRoomBTU: 0,
      overloadedRackCount: 0,
      selectedNodeId: null,
      patchingActive: false,
      activePatchSource: null,
      mousePosition: null,
      sites: INITIAL_SITES,
      currentSiteId: 'site-1',
      placementMode: false,
      pendingRackType: null,
      alerts: [],
      auditLogs: [],
      isNetworkManagerOpen: false,
      isTerminalOpen: false,
      networkLoad: 0.1,
      resilienceIndex: 100,
      postMortems: [],
      incidents: [],
      isAutoPilot: false,
      assistantTargetId: null,
      isSaveManagerOpen: false,
      terminalStates: INITIAL_TERMINAL_STATE,
      deploymentQueue: [],
      isHeatMapVisible: false,
      realTimePlayedSeconds: 0,
      playerAuthority: 'SIMULATION_CRITICAL',
      setPlayerAuthority: (auth) => set({ playerAuthority: auth }),
      balance: 100000,
      reputation: 50,
      reputationHistory: [],
      activeContracts: [],
      loans: [],
      consecutiveNegativeMonths: 0,
      isBankrupt: false,
      isGlobalMapOpen: false,
      globalTargetFirmware: 'v1.0.0',
      cloudBurstingActive: false,
      activeCloudInstances: 0,

      ...getInitialCloudState(),

      dnsRecords: [],
      dhcpLeases: [],
      availableIPPool: Array.from({ length: 154 }, (_, i) => `10.0.0.${101 + i}`),
      ntpSyncStatus: [],
      networkUptime: 100,
      operationalBudget: 1000000,
      capacityUnits: 0,
      blueprints: [],
      previewBlueprintId: null,
      applications: [],
      virtualMachines: [],
      technicianTickets: [],
      isChaosMode: false,
      renderQuality: 'auto',
      activeTheme: 'cyberpunk',

      // Facility Scaling & Architecture
      facilityRowsCount: 4,
      facilityColumnsCount: 17,
      coolingZonesCount: 1,
      powerBlocksCount: 1,
      facilityWingsCount: 1,
      hallWidthCount: 30,
      hallLengthCount: 30,
      halls: [{ id: 'hall-0-0', x: 0, z: 0 }],

      // --- ACTION SLICES ---
      ...createSimulationSlice(set, get, api),
      // UI Slice removed - delegated to useUIStore
      ...createInventorySlice(set, get, api),
      ...createTerminalSlice(set, get, api),
      ...createContractSlice(set, get, api),
      ...createSaveSlice(set, get, api),
      ...createMiscSlice(set, get, api),
      ...createNetworkingSlice(set, get, api),
      ...createAppSlice(set, get, api),
      ...createCameraSlice(set, get, api),
      ...createInteractionSlice(set, get, api),
      ...createEconomySlice(set, get, api),
      ...createProgressionSlice(set, get, api),
      ...createStorageSlice(set, get, api),
      ...createAutomationSlice(set, get, api),
      ...createCloudSlice(set, get, api),
      ...createItsmSlice(set, get, api),

      // --- ROOT ACTIONS ---
      processCommand: (text: any) => handleCommand(get, set, text),
      
      // UI PROXY ACTIONS
      setNetworkLoad: (load) => useUIStore.getState().setNetworkLoad(load),
      setNetworkManagerOpen: (open) => useUIStore.getState().setNetworkManagerOpen(open),
      setCurrentSiteId: (siteId) => useUIStore.getState().setCurrentSiteId(siteId),
      setMousePosition: (pos) => useUIStore.getState().setMousePosition(pos),
      toggleHeatMap: () => useUIStore.getState().toggleHeatMap(),
      toggleGlobalMap: () => useUIStore.getState().toggleGlobalMap(),
      setIsTerminalOpen: (val) => useUIStore.getState().setIsTerminalOpen(val),
      setRenderQuality: (quality) => useUIStore.getState().setRenderQuality(quality),
      setTheme: (theme) => useUIStore.getState().setTheme(theme),

      pushAlert: (severity, message, nodeId) => useUIStore.getState().pushAlert(severity, message, nodeId),
      acknowledgeAlert: (id) => useUIStore.getState().acknowledgeAlert(id),
      acknowledgeAllAlerts: () => useUIStore.getState().acknowledgeAllAlerts(),

      resetRackBreaker: (rackId: any) => {
        const { nodes, pushAlert } = get()
        const rack = nodes.find((n: any) => n.id === rackId)
        if (!rack) return

        const nextNodes = nodes.map((node: any) => {
          if (node.id === rackId) {
            return {
              ...node,
              breakerTripped: false,
              overloadSeconds: 0,
              status: 'online' as const,
              systemState: 'running' as const
            }
          }
          if (node.parentRackId === rackId && node.type !== 'rack') {
            return {
              ...node,
              systemState: 'running' as const,
              bootProgress: 100
            }
          }
          return node
        })

        set({ nodes: nextNodes })
        pushAlert('info', `[PDU RESET] Circuit breaker on Server Rack [${rack.name || rack.id}] has been reset successfully. Mounted nodes are powering back on.`, rackId)
      },

      expandFacilityRow: () => {
        const { balance, pushAlert } = get()
        const cost = 50000
        if (balance < cost) {
          pushAlert('warning', `Blocked row expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }
        set((state: any) => {
          const nextRowsCount = state.facilityRowsCount + 1
          syncZoningWithStore(nextRowsCount, state.facilityColumnsCount, state.halls)
          return {
            balance: state.balance - cost,
            facilityRowsCount: nextRowsCount,
            auditLogs: [
              {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type: 'LifecycleEvent',
                message: `Facility row expanded. Row count is now ${nextRowsCount}.`,
                sourceNodeId: 'site-1',
                targetNodeId: 'site-1',
                status: 'Allowed'
              },
              ...state.auditLogs
            ]
          }
        })
        get().gainXp(500, 'Facility Row Expansion')
        pushAlert('info', `Row expansion purchased! Facility capacity expanded to ${get().facilityRowsCount} rows. -$${cost.toLocaleString()}`)
        audioManager.playEffect('success')
      },

      expandFacilityColumns: () => {
        const { balance, pushAlert } = get()
        const cost = 40000
        if (balance < cost) {
          pushAlert('warning', `Blocked lane expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }
        set((state: any) => {
          const nextColumnsCount = state.facilityColumnsCount + 2
          syncZoningWithStore(state.facilityRowsCount, nextColumnsCount, state.halls)
          return {
            balance: state.balance - cost,
            facilityColumnsCount: nextColumnsCount,
            auditLogs: [
              {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type: 'LifecycleEvent',
                message: `Facility columns expanded. Lane count is now ${nextColumnsCount}.`,
                sourceNodeId: 'site-1',
                targetNodeId: 'site-1',
                status: 'Allowed'
              },
              ...state.auditLogs
            ]
          }
        })
        get().gainXp(400, 'Facility Lane Expansion')
        pushAlert('info', `Additional rack lanes added! Maximum lane capacity is now ${get().facilityColumnsCount}. -$${cost.toLocaleString()}`)
        audioManager.playEffect('success')
      },

      expandCoolingZone: () => {
        const { balance, pushAlert } = get()
        const cost = 30000
        if (balance < cost) {
          pushAlert('warning', `Blocked cooling expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }
        set((state: any) => ({
          balance: state.balance - cost,
          coolingZonesCount: state.coolingZonesCount + 1,
          auditLogs: [
            {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: 'LifecycleEvent',
              message: `Cooling Zone ${state.coolingZonesCount + 1} commissioned.`,
              sourceNodeId: 'site-1',
              targetNodeId: 'site-1',
              status: 'Allowed'
            },
            ...state.auditLogs
          ]
        }))
        get().gainXp(300, 'Cooling Capacity Expansion')
        pushAlert('info', `Cooling capacity expanded! Heavy CRAC/CRAH zones added. -$${cost.toLocaleString()}`)
      },

      upgradeRackContainment: (rackId: string, type: 'none' | 'cold_aisle' | 'hot_aisle') => {
        const rack = get().nodes.find((n: any) => n.id === rackId)
        if (!rack || rack.type !== 'rack') return
        if (rack.containmentType === type) return
        
        // Changing to a containment type costs $1,500. Changing to 'none' is free.
        if (type !== 'none') {
          const cost = 1500
          if (get().balance < cost) {
            get().pushAlert('warning', `Insufficient funds for Containment Upgrade. Requires $${cost.toLocaleString()}.`)
            return
          }
          set((state: any) => ({ balance: state.balance - cost }))
          get().gainXp(50, 'Containment Optimization')
          get().pushAlert('info', `Purchased ${type.replace('_', ' ').toUpperCase()} containment for ${rack.name || rack.id.slice(0, 6)}! -$${cost.toLocaleString()}`)
        }

        set((state: any) => ({
          nodes: state.nodes.map((n: any) => n.id === rackId ? { ...n, containmentType: type } : n)
        }))
      },

      installBlankingPanels: (rackId: string) => {
        const rack = get().nodes.find((n: any) => n.id === rackId)
        if (!rack || rack.type !== 'rack') return
        
        const cost = 200
        if (get().balance < cost) {
          get().pushAlert('warning', `Insufficient funds for Blanking Panels. Requires $${cost.toLocaleString()}.`)
          return
        }
        
        set((state: any) => ({
          balance: state.balance - cost,
          nodes: state.nodes.map((n: any) => n.id === rackId ? { ...n, blankingPanels: new Array(n.uHeight || 42).fill(true) } : n)
        }))
        get().gainXp(20, 'Airflow Optimization')
        get().pushAlert('info', `Installed Blanking Panels on ${rack.name || rack.id.slice(0, 6)}! Airflow bypass stopped. -$${cost.toLocaleString()}`)
      },

      setServerPhase: (nodeId: string, phase: 'A' | 'B' | 'C') => {
        set((state: any) => ({
          nodes: state.nodes.map((n: any) => n.id === nodeId ? { ...n, phase } : n)
        }))
      },

      upgradeServerPSU: (nodeId: string) => {
        const node = get().nodes.find((n: any) => n.id === nodeId)
        if (!node) return
        
        const cost = 400
        if (get().balance < cost) {
          get().pushAlert('warning', `Insufficient funds for Dual PSU upgrade. Requires $${cost.toLocaleString()}.`)
          return
        }
        
        set((state: any) => ({
          balance: state.balance - cost,
          nodes: state.nodes.map((n: any) => n.id === nodeId ? { ...n, dualPSU: true } : n)
        }))
        get().gainXp(10, 'Hardware Redundancy')
        get().pushAlert('info', `Upgraded to Dual PSU on ${node.name || node.id.slice(0, 6)}! -$${cost.toLocaleString()}`)
      },

      upgradeRackPDU: (rackId: string) => {
        const rack = get().nodes.find((n: any) => n.id === rackId)
        if (!rack || rack.type !== 'rack') return
        
        const cost = 2500
        if (get().balance < cost) {
          get().pushAlert('warning', `Insufficient funds for Redundant PDU. Requires $${cost.toLocaleString()}.`)
          return
        }
        
        set((state: any) => ({
          balance: state.balance - cost,
          nodes: state.nodes.map((n: any) => n.id === rackId ? { ...n, pduFeeds: 'A+B' } : n)
        }))
        get().gainXp(50, 'Power Redundancy')
        get().pushAlert('info', `Installed Redundant Feed B PDU on ${rack.name || rack.id.slice(0, 6)}! -$${cost.toLocaleString()}`)
      },

      toggleFacilityFeed: (feed: 'A' | 'B', status: boolean) => {
        // We will dispatch this to the Simulation Engine as well, 
        // but for now we set a global flag or update nodes. 
        // We'll manage facilityFeeds state on the `PowerSystem.facilityFeeds` via an event in the ECS synchronizer, 
        // but let's fire an alert here.
        if (!status) {
          get().pushAlert('critical', `UTILITY OUTAGE: Facility Feed ${feed} has lost power!`)
        } else {
          get().pushAlert('info', `UTILITY RESTORED: Facility Feed ${feed} is back online.`)
        }
        // In this implementation, the `PowerSystem.facilityFeeds` is globally accessible.
        // We can't import it directly here due to circular deps maybe, so we dispatch an event.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('infra:facilityFeedToggle', { detail: { feed, status } }))
        }
      },

      expandPowerBlock: () => {
        const { balance, pushAlert } = get()
        const cost = 40000
        if (balance < cost) {
          pushAlert('warning', `Blocked power expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }
        set((state: any) => ({
          balance: state.balance - cost,
          powerBlocksCount: state.powerBlocksCount + 1,
          auditLogs: [
            {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: 'LifecycleEvent',
              message: `Power block ${state.powerBlocksCount + 1} integrated.`,
              sourceNodeId: 'site-1',
              targetNodeId: 'site-1',
              status: 'Allowed'
            },
            ...state.auditLogs
          ]
        }))
        get().gainXp(400, 'Power Block Expansion')
        pushAlert('info', `UPS/Transformer block integrated! Primary electrical capacity increased. -$${cost.toLocaleString()}`)
        audioManager.playEffect('success')
      },

      expandFacilityWing: () => {
        const { balance, pushAlert } = get()
        const cost = 100000
        if (balance < cost) {
          pushAlert('warning', `Blocked facility wing expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }
        set((state: any) => ({
          balance: state.balance - cost,
          facilityWingsCount: state.facilityWingsCount + 1,
          auditLogs: [
            {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: 'LifecycleEvent',
              message: `Facility Wing B-${state.facilityWingsCount + 1} constructed.`,
              sourceNodeId: 'site-1',
              targetNodeId: 'site-1',
              status: 'Allowed'
            },
            ...state.auditLogs
          ]
        }))
        get().gainXp(1000, 'Facility Wing Constructed')
        pushAlert('info', `Secondary facility wing constructed! Enterprise footprint significantly increased. -$${cost.toLocaleString()}`)
        audioManager.playEffect('success')
      },

      expandHall: () => {
        const { balance, pushAlert } = get()
        const cost = 80000
        if (balance < cost) {
          pushAlert('warning', `Blocked hall expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }
        set((state: any) => ({
          balance: state.balance - cost,
          hallWidthCount: state.hallWidthCount + 10,
          hallLengthCount: state.hallLengthCount + 10,
          auditLogs: [
            {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: 'LifecycleEvent',
              message: `Hyperscaler deployment hall expanded to ${state.hallWidthCount + 10}x${state.hallLengthCount + 10}m.`,
              sourceNodeId: 'site-1',
              targetNodeId: 'site-1',
              status: 'Allowed'
            },
            ...state.auditLogs
          ]
        }))
        get().gainXp(800, 'Hall Perimeter Expanded')
        pushAlert('info', `Datacenter hall perimeter expanded! Space for deployment increased. -$${cost.toLocaleString()}`)
        audioManager.playEffect('success')
      },

      expandHallDirection: (hx: number, hz: number, direction: 'N' | 'S' | 'E' | 'W') => {
        const { balance, halls, pushAlert } = get()
        const cost = 150000

        if (balance < cost) {
          pushAlert('warning', `Blocked hall expansion: Insufficient funds ($${cost.toLocaleString()} required).`)
          audioManager.playEffect('error')
          return
        }

        let tx = hx
        let tz = hz
        if (direction === 'N') tz = hz - 1
        else if (direction === 'S') tz = hz + 1
        else if (direction === 'E') tx = hx + 1
        else if (direction === 'W') tx = hx - 1

        // Check boundary limits (5x5 grid, coordinate ranges -2 to 2)
        if (Math.abs(tx) > 2 || Math.abs(tz) > 2) {
          pushAlert('warning', `Blocked hall expansion: Campus size limit reached (Maximum 5x5 halls allowed).`)
          audioManager.playEffect('error')
          return
        }

        // Prevent overlapping
        const isOccupied = halls.some((h: any) => h.x === tx && h.z === tz)
        if (isOccupied) {
          pushAlert('warning', 'Blocked hall expansion: An active hall already occupies this coordinate.')
          audioManager.playEffect('error')
          return
        }

        const newHallId = `hall-${tx}-${tz}`
        const newHall = { id: newHallId, x: tx, z: tz }
        const nextHalls = [...halls, newHall]

        // Synchronously update zoning so overhead wires and slots appear immediately
        syncZoningWithStore(get().facilityRowsCount, get().facilityColumnsCount, nextHalls)

        set((state: any) => ({
          balance: state.balance - cost,
          halls: nextHalls,
          auditLogs: [
            {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              type: 'LifecycleEvent',
              message: `Campus expanded. Datacenter Hall commissioned at grid (${tx}, ${tz}).`,
              sourceNodeId: 'site-1',
              targetNodeId: 'site-1',
              status: 'Allowed'
            },
            ...state.auditLogs
          ]
        }))
        
        get().gainXp(1500, 'New Datacenter Hall Commissioned')
        pushAlert('info', `Datacenter Hall Wing integrated at grid (${tx}, ${tz})! -$${cost.toLocaleString()}`)
        audioManager.playEffect('success')
      }
    }),
    {
      name: 'infra-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist critical data
      partialize: (state) => ({
        nodes: state.nodes,
        connections: state.connections,
        sites: state.sites,
        balance: state.balance,
        reputation: state.reputation,
        companyLevel: state.companyLevel,
        experience: state.experience,
        xpToNextLevel: state.xpToNextLevel,
        realTimePlayedSeconds: state.realTimePlayedSeconds,
        activeContracts: state.activeContracts,
        loans: state.loans,
        consecutiveNegativeMonths: state.consecutiveNegativeMonths,
        isBankrupt: state.isBankrupt,
        blueprints: state.blueprints,
        applications: state.applications,
        virtualMachines: state.virtualMachines,
        technicianTickets: state.technicianTickets,
        terminalStates: state.terminalStates,
        renderQuality: state.renderQuality,
        activeTheme: state.activeTheme,

        facilityRowsCount: state.facilityRowsCount,
        facilityColumnsCount: state.facilityColumnsCount,
        coolingZonesCount: state.coolingZonesCount,
        powerBlocksCount: state.powerBlocksCount,
        facilityWingsCount: state.facilityWingsCount,
        hallWidthCount: state.hallWidthCount,
        hallLengthCount: state.hallLengthCount,
        halls: state.halls,
        automationPolicies: state.automationPolicies,
        globalTargetFirmware: state.globalTargetFirmware
      })
    }
  )
)

