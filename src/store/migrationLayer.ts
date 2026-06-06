import { useInfraStore } from './useInfraStore'
import { useTelemetryStore } from './useTelemetryStore'
import { useObservabilityStore } from './useObservabilityStore'
import { useGameplayStore } from './useGameplayStore'

/**
 * Migration Layer
 * Synchronizes atomic decoupled stores back into the useInfraStore monolith 
 * to prevent React components from crashing while they are incrementally refactored.
 */
export function initializeStateMigration() {
  // Sync Telemetry State
  useTelemetryStore.subscribe((state) => {
    useInfraStore.setState({
      realTimePlayedSeconds: state.realTimePlayedSeconds,
      networkLoad: state.networkLoad,
      resilienceIndex: state.resilienceIndex,
      totalPowerKW: state.totalPowerKW,
      totalRoomBTU: state.totalRoomBTU,
      overloadedRackCount: state.overloadedRackCount,
      networkUptime: state.networkUptime,
      cloudEgressGB: state.cloudEgressGB,
      activeCloudInstances: state.activeCloudInstances
    } as any)
  })

  // Sync Observability State
  useObservabilityStore.subscribe((state) => {
    useInfraStore.setState({
      auditLogs: state.auditLogs,
      postMortems: state.postMortems,
      incidents: state.incidents,
      technicianTickets: state.technicianTickets
    } as any)
  })

  // Sync Gameplay State
  useGameplayStore.subscribe((state) => {
    useInfraStore.setState({
      balance: state.balance,
      reputation: state.reputation,
      reputationHistory: state.reputationHistory,
      operationalBudget: state.operationalBudget,
      playerAuthority: state.playerAuthority,
      isAutoPilot: state.isAutoPilot,
      isBankrupt: state.isBankrupt,
      consecutiveNegativeMonths: state.consecutiveNegativeMonths,
      activeContracts: state.activeContracts,
      loans: state.loans
    } as any)
  })
}
