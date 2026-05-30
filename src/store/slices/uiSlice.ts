import type { StateCreator } from 'zustand'
import { Vector3 } from 'three'
import type { InfraState } from '../infraStoreTypes'
import { audioManager } from '../../utils/AudioManager'
import type { ThemeKey } from '../themeTypes'

// Keep track of when alert types (by template and node) were acknowledged
const acknowledgedAt = new Map<string, number>()

export function normalizeAlertMessage(msg: string): string {
  return msg.replace(/\d+(\.\d+)?/g, '#')
}

export function clearAlertSuppressions(): void {
  acknowledgedAt.clear()
}

export interface UISlice {
  setNetworkLoad: (load: number) => void
  setNetworkManagerOpen: (open: boolean) => void
  setCurrentSiteId: (siteId: string) => void
  setMousePosition: (pos: Vector3 | null) => void
  toggleHeatMap: () => void
  toggleGlobalMap: () => void
  toggleEoc: () => void
  pushAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId?: string) => void
  acknowledgeAlert: (id: string) => void
  acknowledgeAllAlerts: () => void
  setIsTerminalOpen: (val: boolean) => void
  setRenderQuality: (quality: 'ultra' | 'auto' | 'low') => void
  setTheme: (theme: ThemeKey) => void
  timeFormat: '24h' | '12h'
  setTimeFormat: (format: '24h' | '12h') => void
}

export const createUISlice: StateCreator<InfraState, [], [], UISlice> = (set, get) => ({
  setNetworkLoad: (load) => set({ networkLoad: load }),
  setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
  setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
  toggleHeatMap: () => set(state => ({ isHeatMapVisible: !state.isHeatMapVisible })),
  toggleGlobalMap: () => set(state => ({ isGlobalMapOpen: !state.isGlobalMapOpen })),
  toggleEoc: () => set(state => ({ isEocOpen: !state.isEocOpen })),
  setIsTerminalOpen: (val: boolean) => set({ isTerminalOpen: val }),
  setRenderQuality: (quality) => set({ renderQuality: quality }),
  setTheme: (theme) => set({ activeTheme: theme }),
  timeFormat: '24h',
  setTimeFormat: (format) => set({ timeFormat: format }),

  pushAlert: (severity, message, nodeId) => {
    // 10-minute suppression filter for acknowledged alerts (600,000ms)
    const normalized = normalizeAlertMessage(message)
    const key = `${severity}:${normalized}:${nodeId || ''}`
    const lastAck = acknowledgedAt.get(key)
    if (lastAck !== undefined) {
      const elapsed = Date.now() - lastAck
      if (elapsed < 10 * 60 * 1000) {
        return // Suppress acknowledged recurring alert
      }
    }

    if (severity === 'critical') {
      audioManager.playEffect('error')
      // Apply immediate reputation penalty for severe infrastructure incidents
      if (message.includes('[THERMAL CRITICAL]') || message.includes('[RACK OVERLOAD]') || message.includes('Hardware failed')) {
        const state = get()
        if (state.adjustReputation) {
          state.adjustReputation(-2, 'Critical Infrastructure Incident')
        }
      }
    }
    else if (severity === 'warning') audioManager.playEffect('alert')
    
    set((state) => ({
      alerts: [{ 
        id: crypto.randomUUID(), 
        timestamp: Date.now(), 
        cycle: Math.floor(state.realTimePlayedSeconds), 
        severity, 
        message, 
        isAcknowledged: false, 
        nodeId 
      }, ...state.alerts].slice(0, 100)
    }))
  },

  acknowledgeAlert: (id) => {
    set((state) => {
      const alert = state.alerts.find(a => a.id === id)
      if (alert) {
        const normalized = normalizeAlertMessage(alert.message)
        const key = `${alert.severity}:${normalized}:${alert.nodeId || ''}`
        acknowledgedAt.set(key, Date.now())
      }
      return {
        alerts: state.alerts.map(a => a.id === id ? { ...a, isAcknowledged: true } : a)
      }
    })
  },

  acknowledgeAllAlerts: () => {
    set((state) => {
      state.alerts.forEach(alert => {
        if (!alert.isAcknowledged) {
          const normalized = normalizeAlertMessage(alert.message)
          const key = `${alert.severity}:${normalized}:${alert.nodeId || ''}`
          acknowledgedAt.set(key, Date.now())
        }
      })
      return {
        alerts: state.alerts.map(a => ({ ...a, isAcknowledged: true }))
      }
    })
  }
})
