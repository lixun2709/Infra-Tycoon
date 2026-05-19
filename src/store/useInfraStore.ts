import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { InfraState } from './infraStoreTypes'
import { INITIAL_SITES, INITIAL_TERMINAL_STATE } from './infraInitialState'
import { createSimulationSlice } from './slices/simulationSlice'
import { createUISlice } from './slices/uiSlice'
import { createInventorySlice } from './slices/inventorySlice'
import { createTerminalSlice } from './slices/terminalSlice'
import { createContractSlice } from './slices/contractSlice'
import { createSaveSlice } from './slices/saveSlice'
import { createMiscSlice } from './slices/miscSlice'
import { createNetworkingSlice } from './slices/networkingSlice'
import { createAppSlice } from './slices/appSlice'
import { createCameraSlice } from './slices/cameraSlice'
import { createInteractionSlice } from './slices/interactionSlice'
import { handleCommand } from './terminalLogic'

export const useInfraStore = create<InfraState>()(
  persist(
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
      isAutoPilot: false,
      assistantTargetId: null,
      isSaveManagerOpen: false,
      terminalStates: INITIAL_TERMINAL_STATE,
      deploymentQueue: [],
      isHeatMapVisible: false,
      realTimePlayedSeconds: 0,
      balance: 1000000,
      reputation: 85,
      activeContracts: [],
      isGlobalMapOpen: false,
      cloudBurstingActive: false,
      activeCloudInstances: 0,
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
      technicianTickets: [],
      isChaosMode: false,
      renderQuality: 'auto',
      activeTheme: 'cyberpunk',

      // --- ACTION SLICES ---
      ...createSimulationSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createInventorySlice(set, get, api),
      ...createTerminalSlice(set, get, api),
      ...createContractSlice(set, get, api),
      ...createSaveSlice(set, get, api),
      ...createMiscSlice(set, get, api),
      ...createNetworkingSlice(set, get, api),
      ...createAppSlice(set, get, api),
      ...createCameraSlice(set, get, api),
      ...createInteractionSlice(set, get, api),

      // --- ROOT ACTIONS ---
      processCommand: (text) => handleCommand(get, set, text),
      resetRackBreaker: (rackId) => {
        const { nodes, pushAlert } = get()
        const rack = nodes.find(n => n.id === rackId)
        if (!rack) return

        const nextNodes = nodes.map(node => {
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
        realTimePlayedSeconds: state.realTimePlayedSeconds,
        activeContracts: state.activeContracts,
        blueprints: state.blueprints,
        applications: state.applications,
        technicianTickets: state.technicianTickets,
        terminalStates: state.terminalStates,
        renderQuality: state.renderQuality,
        activeTheme: state.activeTheme,
        timeFormat: state.timeFormat
      })
    }
  )
)