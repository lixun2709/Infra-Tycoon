import type { ServiceType } from '../store/infraTypes'

export interface ApplicationRequirement {
  minRAMGB: number
  minStorageGB: number
  minCores: number
  requiredServices: ServiceType[]
  minFLOPS?: number
}

export interface Application {
  id: string
  name: string
  category: 'web' | 'database' | 'storage' | 'security' | 'orchestration' | 'ai'
  description: string
  requirements: ApplicationRequirement
  icon: string // For holographic representation
  color: string
  deploymentCost: number
}

export const APPLICATION_CATALOG: Record<string, Application> = {
  wordpress: {
    id: 'wordpress',
    name: 'WordPress CMS',
    category: 'web',
    description: 'Enterprise content management system requiring PHP and MySQL.',
    requirements: {
      minRAMGB: 2,
      minStorageGB: 10,
      minCores: 2,
      requiredServices: ['DNS']
    },
    icon: '🌐',
    color: '#21759b',
    deploymentCost: 1500
  },
  postgres: {
    id: 'postgres',
    name: 'PostgreSQL Cluster',
    category: 'database',
    description: 'Highly available relational database for production workloads.',
    requirements: {
      minRAMGB: 8,
      minStorageGB: 100,
      minCores: 4,
      requiredServices: []
    },
    icon: '💾',
    color: '#336791',
    deploymentCost: 5000
  },
  redis: {
    id: 'redis',
    name: 'Redis Sentinel',
    category: 'storage',
    description: 'High-performance in-memory data store used as a database or cache.',
    requirements: {
      minRAMGB: 16,
      minStorageGB: 5,
      minCores: 2,
      requiredServices: []
    },
    icon: '⚡',
    color: '#d82c20',
    deploymentCost: 3000
  },
  k8s_master: {
    id: 'k8s_master',
    name: 'Kubernetes Master',
    category: 'orchestration',
    description: 'The brain of the container orchestration system.',
    requirements: {
      minRAMGB: 4,
      minStorageGB: 40,
      minCores: 2,
      requiredServices: ['DNS', 'NTP']
    },
    icon: '☸️',
    color: '#326ce5',
    deploymentCost: 2500
  },
  llm_training_gpt4: {
    id: 'llm_training_gpt4',
    name: 'LLM Foundation Training (100B+ Params)',
    category: 'ai',
    description: 'Massive parallel training workload. Requires H100 SuperNODEs and Infiniband networking to prevent stalled epochs.',
    requirements: {
      minRAMGB: 4096,
      minStorageGB: 10000,
      minCores: 512,
      requiredServices: [],
      minFLOPS: 100000 // Requires massive throughput
    },
    icon: '🧠',
    color: '#059669',
    deploymentCost: 50000
  }
}
