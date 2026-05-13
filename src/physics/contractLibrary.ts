export type ContractTier = 'SME' | 'Enterprise' | 'Government' | 'Research'

export interface ContractRequirement {
  appId: string
  count: number
  redundant?: boolean // Must be on different racks
}

export interface ContractBlueprint {
  id: string
  name: string
  tier: ContractTier
  description: string
  monthlyMRR: number
  slaTarget: number // 0-100 (e.g. 99.9)
  penaltyPerTick: number // Deducted from payout if requirements not met
  requirements: ContractRequirement[]
  minReputation: number
  color: string
}

export interface ActiveContract {
  id: string
  blueprintId: string
  startDate: number
  uptimeTicks: number
  totalTicks: number
  currentStatus: 'healthy' | 'violating'
  accumulatedPenalty: number
}

export const CONTRACT_CATALOG: Record<string, ContractBlueprint> = {
  sme_starter: {
    id: 'sme_starter',
    name: 'TechStart SaaS',
    tier: 'SME',
    description: 'Basic web presence for a growing startup.',
    monthlyMRR: 1200,
    slaTarget: 95,
    penaltyPerTick: 10,
    minReputation: 0,
    color: '#38bdf8',
    requirements: [
      { appId: 'wordpress', count: 1 }
    ]
  },
  ecom_pro: {
    id: 'ecom_pro',
    name: 'GlobalCart Retail',
    tier: 'Enterprise',
    description: 'High-availability e-commerce platform with database backend.',
    monthlyMRR: 8500,
    slaTarget: 99.9,
    penaltyPerTick: 150,
    minReputation: 40,
    color: '#818cf8',
    requirements: [
      { appId: 'wordpress', count: 2, redundant: true },
      { appId: 'postgres', count: 1 }
    ]
  },
  gov_secure: {
    id: 'gov_secure',
    name: 'Dept of Digital Safety',
    tier: 'Government',
    description: 'Mission-critical infrastructure with strict security requirements.',
    monthlyMRR: 45000,
    slaTarget: 99.99,
    penaltyPerTick: 2500,
    minReputation: 75,
    color: '#f87171',
    requirements: [
      { appId: 'k8s_master', count: 1 },
      { appId: 'postgres', count: 2, redundant: true },
      { appId: 'redis', count: 1 }
    ]
  }
}
