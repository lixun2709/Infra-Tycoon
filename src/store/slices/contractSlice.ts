import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'
import { audioManager } from '../../utils/AudioManager'

export interface ContractSlice {
  acceptContract: (blueprintId: string) => void
  cancelContract: (id: string) => void
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

    set(state => ({
      activeContracts: [...state.activeContracts, newContract]
    }))
    
    audioManager.playEffect('success')
    get().pushAlert('info', `CONTRACT SIGNED: ${blueprint.name} is now active.`)
  },

  cancelContract: (id) => {
    set(state => ({
      activeContracts: state.activeContracts.filter(c => c.id !== id)
    }))
    get().pushAlert('info', 'Contract cancelled by operator.')
  }
})
