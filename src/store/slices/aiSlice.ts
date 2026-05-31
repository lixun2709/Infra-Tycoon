import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'

export interface AISlice {
  isAIDashboardOpen: boolean
  toggleAIDashboard: () => void
}

export const createAISlice: StateCreator<InfraState, [], [], AISlice> = (set) => ({
  isAIDashboardOpen: false,
  
  toggleAIDashboard: () => set(state => ({ isAIDashboardOpen: !state.isAIDashboardOpen }))
})
