import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import type { AutomationPolicy } from '../infraTypes'
import { audioManager } from '../../utils/AudioManager'

export interface AutomationSlice {
  automationPolicies: AutomationPolicy[]
  addAutomationPolicy: (policy: Omit<AutomationPolicy, 'id' | 'lastFiredAt'>) => void
  removeAutomationPolicy: (id: string) => void
  toggleAutomationPolicy: (id: string, enabled: boolean) => void
  updateAutomationPolicy: (id: string, updates: Partial<AutomationPolicy>) => void
  _internalSetFiredPolicies: (fired: { id: string, firedAt: number }[]) => void
}

export const createAutomationSlice: StateCreator<InfraState, [], [], AutomationSlice> = (set, get) => ({
  automationPolicies: [],

  addAutomationPolicy: (policy) => {
    set((state: any) => ({
      automationPolicies: [
        ...state.automationPolicies,
        {
          ...policy,
          id: crypto.randomUUID(),
          lastFiredAt: 0
        }
      ]
    }))
    get().pushAlert('info', `Automation Policy '${policy.name}' created successfully.`)
    audioManager.playEffect('success')
  },

  removeAutomationPolicy: (id: string) => {
    set((state: any) => ({
      automationPolicies: state.automationPolicies.filter((p: any) => p.id !== id)
    }))
    audioManager.playEffect('click')
  },

  toggleAutomationPolicy: (id: string, enabled: boolean) => {
    set((state: any) => ({
      automationPolicies: state.automationPolicies.map((p: any) => p.id === id ? { ...p, enabled } : p)
    }))
    audioManager.playEffect('click')
  },

  updateAutomationPolicy: (id: string, updates: Partial<AutomationPolicy>) => {
    set((state: any) => ({
      automationPolicies: state.automationPolicies.map((p: any) => p.id === id ? { ...p, ...updates } : p)
    }))
  },

  _internalSetFiredPolicies: (fired) => {
    if (fired.length === 0) return
    set((state: any) => {
      const nextPolicies = [...state.automationPolicies]
      let changed = false
      fired.forEach(f => {
        const idx = nextPolicies.findIndex(p => p.id === f.id)
        if (idx !== -1) {
          const p = nextPolicies[idx]
          if (p && p.lastFiredAt !== f.firedAt) {
            nextPolicies[idx] = { ...p, lastFiredAt: f.firedAt } as AutomationPolicy
            changed = true
          }
        }
      })
      if (!changed) return state
      return { automationPolicies: nextPolicies }
    })
  }
})
