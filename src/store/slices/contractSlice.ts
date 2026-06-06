/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { CONTRACT_CATALOG, type ContractBlueprint } from '../../physics/contractLibrary'
import { audioManager } from '../../utils/AudioManager'

export interface ContractSlice {
  acceptContract: (blueprintId: string) => void
  cancelContract: (id: string) => void
  marketContracts: ContractBlueprint[]
  refreshMarketContracts: () => void
}

export const createContractSlice: StateCreator<InfraState, [], [], ContractSlice> = (set, get) => ({
  acceptContract: (blueprintId) => {
    const blueprint = CONTRACT_CATALOG[blueprintId]
    if (!blueprint) return

    const newContract = {
      id: crypto.randomUUID(),
      blueprintId,
      startDate: Date.now(),
      totalTicks: 0,
      uptimeTicks: 0,
      currentStatus: 'healthy' as const,
      accumulatedPenalty: 0
    }

    set((state: any) => ({
      activeContracts: [...state.activeContracts, newContract]
    }))
    
    audioManager.playEffect('success')
    get().pushAlert('info', `[CONTRACT SIGNED] ${blueprint.name}. Required uptime: ${blueprint.slaTarget}%. SLA Active.`, 'NOC-SYSTEM')
  },

  cancelContract: (id) => {
    set((state: any) => ({
      activeContracts: state.activeContracts.filter((c: any) => c.id !== id)
    }))
    get().pushAlert('warning', '[SLA TERMINATED] Contract cancelled by operator. Financial penalty may apply.', 'NOC-SYSTEM')
  },

  marketContracts: [],

  refreshMarketContracts: () => {
    const rep = get().reputation
    const scale = get().nodes.length
    
    // Generate 3 random contracts
    const newMarket = [
      import('../../physics/contractLibrary').then(m => m.generateDynamicContract(rep, scale)),
      import('../../physics/contractLibrary').then(m => m.generateDynamicContract(rep, scale)),
      import('../../physics/contractLibrary').then(m => m.generateDynamicContract(rep, scale))
    ]

    Promise.all(newMarket).then(contracts => {
      // Add them to the static catalog so lookups still work
      contracts.forEach(c => { CONTRACT_CATALOG[c.id] = c })
      
      set({ marketContracts: contracts })
    })
  }
})

