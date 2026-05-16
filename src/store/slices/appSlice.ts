import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import type { ApplicationDeployment } from '../infraTypes'
import { APPLICATION_CATALOG } from '../../physics/applicationLibrary'

export interface AppSlice {
  deployApplication: (appId: string, nodeId: string) => void
  removeApplication: (id: string) => void
}

export const createAppSlice: StateCreator<InfraState, [], [], AppSlice> = (set, get) => ({
  deployApplication: (appId, nodeId) => {
    const { balance, pushAlert } = get()
    const spec = APPLICATION_CATALOG[appId]
    if (!spec) return

    const deploymentCost = spec.deploymentCost || 0
    if (balance < deploymentCost) {
      pushAlert('warning', `Insufficient funds to deploy ${spec.name}`)
      return
    }

    const newApp: ApplicationDeployment = {
      id: crypto.randomUUID(),
      appId,
      nodeId,
      status: 'deploying' as const,
      progress: 0
    }

    set(state => ({
      applications: [...state.applications, newApp],
      balance: state.balance - deploymentCost
    }))
    
    pushAlert('info', `Deploying ${spec.name} to ${nodeId.slice(0,8)}...`)
    
    // Simulate progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 25
      set(state => ({
        applications: state.applications.map(a => a.id === newApp.id ? { ...a, progress } : a)
      }))
      if (progress >= 100) {
        clearInterval(interval)
        set(state => ({
          applications: state.applications.map(a => a.id === newApp.id ? { ...a, status: 'running' } : a)
        }))
      }
    }, 2000)
  },

  removeApplication: (id) => {
    set(state => ({
      applications: state.applications.filter(a => a.id !== id)
    }))
  }
})
