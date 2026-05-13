import { useInfraStore } from '../store/useInfraStore'

export interface CloudProvider {
  id: string
  name: string
  region: string
  instanceCostPerTick: number
  egressCostPerGB: number
}

export const CLOUD_PROVIDERS: CloudProvider[] = [
  { id: 'aws_us_east', name: 'AWS US-East-1', region: 'US-East', instanceCostPerTick: 5, egressCostPerGB: 0.08 },
  { id: 'azure_eu_west', name: 'Azure EU-West', region: 'EU-West', instanceCostPerTick: 4.5, egressCostPerGB: 0.07 },
  { id: 'gcp_asia_east', name: 'GCP Asia-East', region: 'Asia-East', instanceCostPerTick: 6, egressCostPerGB: 0.12 }
]

export function calculateCloudCosts(activeInstances: number, egressGB: number, providerId: string): number {
  const provider = CLOUD_PROVIDERS.find(p => p.id === providerId) || CLOUD_PROVIDERS[0]
  return (activeInstances * provider.instanceCostPerTick) + (egressGB * provider.egressCostPerGB)
}
