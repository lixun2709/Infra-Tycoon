import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import type { ApplicationDeployment, VirtualMachine } from '../infraTypes'
import { APPLICATION_CATALOG } from '../../physics/applicationLibrary'

export interface AppSlice {
  deployApplication: (appId: string, nodeId: string) => void
  removeApplication: (id: string) => void
  deployVirtualMachine: (vmId: string, nodeId: string, config: Omit<VirtualMachine, 'id' | 'nodeId' | 'status' | 'uptimeTicks'>) => void
  startVMotion: (vmId: string, targetNodeId: string) => void
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
  },

  deployVirtualMachine: (vmId, nodeId, config) => {
    const newVm: VirtualMachine = {
      ...config,
      id: vmId,
      nodeId,
      status: 'booting',
      uptimeTicks: 0,
      migratingToNodeId: undefined,
      migrationProgress: undefined
    }

    set(state => ({
      virtualMachines: [...state.virtualMachines, newVm]
    }))
    get().pushAlert('info', `Deploying VM ${config.name} to ${nodeId.slice(0,8)}`)
  },

  startVMotion: (vmId, targetNodeId) => {
    set(state => {
      const vm = state.virtualMachines.find(v => v.id === vmId)
      if (!vm || vm.status !== 'running') {
        get().pushAlert('warning', `VM ${vmId} is not eligible for vMotion.`)
        return state
      }
      return {
        virtualMachines: state.virtualMachines.map(v => 
          v.id === vmId ? { ...v, status: 'migrating', migratingToNodeId: targetNodeId, migrationProgress: 0 } : v
        )
      }
    })
    get().pushAlert('info', `Initiated vMotion for VM ${vmId} to ${targetNodeId.slice(0,8)}`)
  }
})
