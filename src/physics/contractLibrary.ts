import type { ContractTier, ContractRequirement, ContractBlueprint, ActiveContract } from '../store/infraTypes'

export type { ContractTier, ContractRequirement, ContractBlueprint, ActiveContract }

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
    minLevel: 1,
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
    minLevel: 3,
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
    minLevel: 5,
    color: '#f87171',
    requirements: [
      { appId: 'k8s_master', count: 1 },
      { appId: 'postgres', count: 2, redundant: true },
      { appId: 'redis', count: 1 }
    ]
  },
  global_social: {
    id: 'global_social',
    name: 'GlobalNet Social',
    tier: 'Enterprise',
    description: 'Hyperscale social network demanding extreme multi-region availability.',
    monthlyMRR: 500000,
    slaTarget: 99.999,
    penaltyPerTick: 15000,
    minReputation: 85,
    minLevel: 7,
    color: '#10b981',
    requirements: [
      { appId: 'global_lb', count: 1 },
      { appId: 'wordpress', count: 10, redundant: true, multiRegion: true },
      { appId: 'redis', count: 4, redundant: true, multiRegion: true },
      { appId: 'postgres', count: 2, redundant: true, multiRegion: true }
    ]
  },
  transnational_bank: {
    id: 'transnational_bank',
    name: 'TransNational Bank',
    tier: 'Enterprise',
    description: 'Tier-1 financial institution. Zero downtime tolerated.',
    monthlyMRR: 850000,
    slaTarget: 99.9999,
    penaltyPerTick: 50000,
    minReputation: 95,
    minLevel: 8,
    color: '#fbbf24',
    requirements: [
      { appId: 'global_lb', count: 2, redundant: true, multiRegion: true },
      { appId: 'k8s_master', count: 3, redundant: true, multiRegion: true },
      { appId: 'postgres', count: 4, redundant: true, multiRegion: true }
    ]
  }
}

const FIRST_NAMES = ['Acme', 'Global', 'Tech', 'Cyber', 'Nexus', 'Apex', 'Quantum', 'Cloud', 'Data', 'Secure']
const LAST_NAMES = ['Corp', 'Systems', 'Solutions', 'Networks', 'Dynamics', 'Enterprises', 'Labs']
const DOMAINS = ['wordpress', 'postgres', 'redis', 'k8s_master']

export function generateDynamicContract(reputation: number, _currentScale: number): ContractBlueprint {
  const isEnterprise = reputation > 50
  const isGov = reputation > 80
  
  const tier = isGov ? 'Government' : isEnterprise ? 'Enterprise' : 'SME'
  const name = `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`
  
  const id = `dynamic_${crypto.randomUUID().split('-')[0]}`
  
  // Base requirements
  const requirements: ContractRequirement[] = []
  const numReqs = isGov ? 3 : isEnterprise ? 2 : 1
  
  for (let i = 0; i < numReqs; i++) {
    const appId = DOMAINS[Math.floor(Math.random() * DOMAINS.length)]!
    if (!requirements.find(r => r.appId === appId)) {
      requirements.push({
        appId,
        count: Math.floor(Math.random() * (isGov ? 3 : 2)) + 1,
        redundant: isEnterprise || isGov
      })
    }
  }

  // Ensure at least one requirement
  if (requirements.length === 0) {
    requirements.push({ appId: 'wordpress', count: 1 })
  }

  const baseMRR = (isGov ? 25000 : isEnterprise ? 5000 : 800) * requirements.length
  
  return {
    id,
    name,
    tier,
    description: `Procedurally generated ${tier} contract.`,
    monthlyMRR: baseMRR + Math.floor(Math.random() * (baseMRR * 0.2)),
    slaTarget: isGov ? 99.99 : isEnterprise ? 99.9 : 95,
    penaltyPerTick: isGov ? 2000 : isEnterprise ? 200 : 20,
    minReputation: isGov ? 75 : isEnterprise ? 40 : 0,
    minLevel: isGov ? 5 : isEnterprise ? 3 : 1,
    color: isGov ? '#f87171' : isEnterprise ? '#818cf8' : '#38bdf8',
    requirements
  }
}
