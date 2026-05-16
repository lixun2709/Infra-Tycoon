import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import type { SaveMetadata } from '../infraTypes'

export interface SaveSlice {
  saveGame: (slotId: string) => void
  loadGame: (slotId: string) => void
  getAvailableSaves: () => SaveMetadata[]
}

export const createSaveSlice: StateCreator<InfraState, [], [], SaveSlice> = (set, get) => ({
  saveGame: (slotId) => {
    const state = get()
    const snapshot = {
      nodes: state.nodes,
      connections: state.connections,
      sites: state.sites,
      balance: state.balance,
      reputation: state.reputation,
      simulationCycle: state.simulationCycle,
      activeContracts: state.activeContracts,
      applications: state.applications,
      auditLogs: state.auditLogs
    }
    
    const saveKey = `infra_save_${slotId}`
    localStorage.setItem(saveKey, JSON.stringify(snapshot))
    
    const metaKey = `infra_save_meta_${slotId}`
    const meta: SaveMetadata = {
      id: slotId,
      timestamp: Date.now(),
      siteName: `Save Slot ${slotId}`,
      nodeCount: state.nodes.length
    }
    localStorage.setItem(metaKey, JSON.stringify(meta))
    
    get().pushAlert('info', `Game saved to slot ${slotId}`)
  },

  loadGame: (slotId) => {
    const saveKey = `infra_save_${slotId}`
    const data = localStorage.getItem(saveKey)
    if (!data) return

    try {
      const snapshot = JSON.parse(data)
      set({ ...snapshot })
      get().pushAlert('info', `Game loaded from slot ${slotId}`)
    } catch (e) {
      get().pushAlert('critical', `Failed to load save ${slotId}`)
    }
  },

  getAvailableSaves: () => {
    const saves: SaveMetadata[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('infra_save_meta_')) {
        const data = localStorage.getItem(key)
        if (data) saves.push(JSON.parse(data))
      }
    }
    return saves.sort((a, b) => b.timestamp - a.timestamp)
  }
})
