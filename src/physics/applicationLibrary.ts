import type { ServiceType } from '../store/infraTypes'

export interface ApplicationRequirement {
  minRAMGB: number
  minStorageGB: number
  minCores: number
  requiredServices: ServiceType[]
}

export interface Application {
  id: string
  name: string
  category: 'web' | 'database' | 'storage' | 'security' | 'orchestration'
  description: string
  requirements: ApplicationRequirement
  icon: string // For holographic representation
  color: string
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
    color: '#21759b'
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
    color: '#336791'
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
    color: '#d82c20'
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
    color: '#326ce5'
  }
}
