 
import type { ServiceType } from '../store/infraTypes'

export interface ApplicationRequirement {
  minRAMGB: number
  minStorageGB: number
  minCores: number
  requiredServices: ServiceType[]
  minFLOPS?: number
  maxLatencyMs?: number
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
      minCores: 8,
      requiredServices: ['web', 'DNS']
    },
    icon: '🔐',
    color: '#a855f7', // purple-500
    deploymentCost: 15000
  },
  iot_gateway: {
    id: 'iot_gateway',
    name: 'IoT Fleet Aggregator',
    category: 'web',
    description: 'Processes telemetry from regional smart devices. Requires ultra-low latency.',
    requirements: {
      minRAMGB: 4,
      minStorageGB: 50,
      minCores: 4,
      requiredServices: ['web', 'DNS'],
      maxLatencyMs: 30
    },
    icon: '📡',
    color: '#0ea5e9', // sky-500
    deploymentCost: 20000
  },
  cdn_edge_pop: {
    id: 'cdn_edge_pop',
    name: 'CDN Edge Node',
    category: 'storage',
    description: 'High-speed content delivery node for local region streaming.',
    requirements: {
      minRAMGB: 16,
      minStorageGB: 2000,
      minCores: 8,
      requiredServices: ['storage', 'DNS'],
      maxLatencyMs: 25
    },
    icon: '⚡',
    color: '#f59e0b', // amber-500
    deploymentCost: 35000
  },
  v2x_autonomous: {
    id: 'v2x_autonomous',
    name: 'V2X Fleet Coordinator',
    category: 'ai',
    description: 'Real-time inference for autonomous vehicles. Latency-critical.',
    requirements: {
      minRAMGB: 64,
      minStorageGB: 500,
      minCores: 32,
      minFLOPS: 10,
      requiredServices: ['web', 'DNS'],
      maxLatencyMs: 15
    },
    icon: '🚗',
    color: '#ef4444', // red-500
    deploymentCost: 120000
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
  },
  global_lb: {
    id: 'global_lb',
    name: 'Global Load Balancer',
    category: 'web',
    description: 'BGP Anycast routing layer for massive multi-region redundancy. Required for Hyperscale workloads.',
    requirements: {
      minRAMGB: 8,
      minStorageGB: 10,
      minCores: 8,
      requiredServices: ['web', 'DNS']
    },
    icon: '🌍',
    color: '#38bdf8', // light blue
    deploymentCost: 250000
  }
}

