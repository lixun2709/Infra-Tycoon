/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StateCreator } from 'zustand'
import type { InfraState, CloudProvider } from '../infraStoreTypes'

export interface CloudSlice {
  setCloudProvider: (id: string | null) => void
  purchaseReservedInstance: (providerId: string, count: number) => void
  updateSpotInstances: (providerId: string, instances: number) => void
}

const DEFAULT_PROVIDERS: CloudProvider[] = [
  {
    id: 'aws',
    name: 'Amazon Web Systems',
    spotPricePerNode: 280, // $280/mo
    reservedPricePerNode: 150, // $150/mo
    baseLatencyMs: 15,
    reliability: 0.9999,
    activeSpotInstances: 0,
    reservedInstances: 0
  },
  {
    id: 'gcp',
    name: 'Google Compute Platform',
    spotPricePerNode: 250,
    reservedPricePerNode: 160,
    baseLatencyMs: 12,
    reliability: 0.9995,
    activeSpotInstances: 0,
    reservedInstances: 0
  },
  {
    id: 'azure',
    name: 'Microsoft Azure Cloud',
    spotPricePerNode: 310,
    reservedPricePerNode: 140,
    baseLatencyMs: 25,
    reliability: 0.999,
    activeSpotInstances: 0,
    reservedInstances: 0
  }
]

export const createCloudSlice: StateCreator<InfraState, [], [], CloudSlice> = (set, get) => ({
  setCloudProvider: (id) => {
    const provider = get().cloudProviders.find((p: any) => p.id === id)
    if (provider) {
      set({ activeCloudProviderId: id })
      get().pushAlert('info', `Hybrid Cloud Gateway connected to ${provider.name}.`)
    } else {
      set({ activeCloudProviderId: null })
      get().pushAlert('warning', `Hybrid Cloud Gateway disconnected.`)
    }
  },

  purchaseReservedInstance: (providerId, count) => {
    const { cloudProviders, pushAlert } = get()
    
    const provider = cloudProviders.find((p: any) => p.id === providerId)
    if (!provider) return

    set({
      cloudProviders: cloudProviders.map((p: any) => 
        p.id === providerId ? { ...p, reservedInstances: p.reservedInstances + count } : p
      )
    })
    
    pushAlert('info', `Successfully reserved ${count} Instances on ${provider.name}. Billing moved to OPEX.`)
  },

  updateSpotInstances: (providerId, instances) => {
    const { cloudProviders } = get()
    
    const updatedProviders = cloudProviders.map((p: any) => 
      p.id === providerId ? { ...p, activeSpotInstances: instances } : p
    )
    
    // Calculate total
    let totalInstances = 0
    updatedProviders.forEach((p: any) => {
      totalInstances += p.activeSpotInstances + p.reservedInstances
    })

    set({ 
      cloudProviders: updatedProviders,
      activeCloudInstances: totalInstances
    })
  }
})

export const getInitialCloudState = () => ({
  cloudProviders: DEFAULT_PROVIDERS,
  activeCloudProviderId: null
})

