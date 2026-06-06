/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'

export interface StorageSlice {
  isStorageDashboardOpen: boolean
  toggleStorageDashboard: () => void
  rebuildRaidArray: (nodeId: string) => void
  toggleDataService: (nodeId: string, service: 'deduplication' | 'compression', enabled: boolean) => void
  setStorageTier: (nodeId: string, tier: 'hdd' | 'ssd' | 'nvme') => void
}

export const createStorageSlice: StateCreator<InfraState, [], [], StorageSlice> = (set, _get) => ({
  isStorageDashboardOpen: false,
  
  toggleStorageDashboard: () => set((state: any) => ({ isStorageDashboardOpen: !state.isStorageDashboardOpen })),
  
  rebuildRaidArray: (nodeId) => set((state: any) => {
    const node = state.nodes.find((n: any) => n.id === nodeId)
    if (!node || node.type !== 'storage' || node.storageStatus === 'healthy' || node.storageStatus === 'rebuilding') {
      return state // Cannot rebuild
    }
    
    // Check if it's failed and cannot be rebuilt (e.g. too many failed drives)
    // For now, allow rebuilding if degraded or failed
    
    return {
      nodes: state.nodes.map((n: any) => 
        n.id === nodeId 
          ? { 
              ...n, 
              storageStatus: 'rebuilding',
              rebuildProgress: 0,
              // reset degradation so it stops failing further during rebuild
              driveDegradation: 0
            } 
          : n
      )
    }
  }),
  
  toggleDataService: (nodeId, service, enabled) => set((state: any) => {
    return {
      nodes: state.nodes.map((n: any) => {
        if (n.id !== nodeId || n.type !== 'storage') return n
        if (service === 'deduplication') {
          return { ...n, deduplicationEnabled: enabled, deduplicationRatio: enabled ? 2.4 : 1.0 }
        } else {
          return { ...n, compressionEnabled: enabled, compressionRatio: enabled ? 1.5 : 1.0 }
        }
      })
    }
  }),
  
  setStorageTier: (nodeId, tier) => set((state: any) => {
    return {
      nodes: state.nodes.map((n: any) => 
        n.id === nodeId && n.type === 'storage'
          ? { ...n, tier }
          : n
      )
    }
  })
})

