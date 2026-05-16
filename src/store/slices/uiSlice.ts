import type { StateCreator } from 'zustand'
import { Vector3 } from 'three'
import type { InfraState } from '../infraStoreTypes'
import { audioManager } from '../../utils/AudioManager'

export interface UISlice {
  setNetworkLoad: (load: number) => void
  setNetworkManagerOpen: (open: boolean) => void
  setCurrentSiteId: (siteId: string) => void
  setMousePosition: (pos: Vector3 | null) => void
  toggleHeatMap: () => void
  toggleGlobalMap: () => void
  pushAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId?: string) => void
  acknowledgeAlert: (id: string) => void
  acknowledgeAllAlerts: () => void
  setIsTerminalOpen: (val: boolean) => void
}

export const createUISlice: StateCreator<InfraState, [], [], UISlice> = (set) => ({
  setNetworkLoad: (load) => set({ networkLoad: load }),
  setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
  setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
  toggleHeatMap: () => set(state => ({ isHeatMapVisible: !state.isHeatMapVisible })),
  toggleGlobalMap: () => set(state => ({ isGlobalMapOpen: !state.isGlobalMapOpen })),
  setIsTerminalOpen: (val: boolean) => set({ isTerminalOpen: val }),

  pushAlert: (severity, message, nodeId) => {
    if (severity === 'critical') audioManager.playEffect('error')
    else if (severity === 'warning') audioManager.playEffect('alert')
    
    set((state) => ({
      alerts: [{ id: crypto.randomUUID(), timestamp: Date.now(), severity, message, isAcknowledged: false, nodeId }, ...state.alerts].slice(0, 100)
    }))
  },

  acknowledgeAlert: (id) => {
    set((state) => ({
      alerts: state.alerts.map(a => a.id === id ? { ...a, isAcknowledged: true } : a)
    }))
  },

  acknowledgeAllAlerts: () => {
    set((state) => ({
      alerts: state.alerts.map(a => ({ ...a, isAcknowledged: true }))
    }))
  }
})
