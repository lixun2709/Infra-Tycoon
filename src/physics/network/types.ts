import type { Connection } from '../../store/infraTypes'

export interface IncidentProfile {
  type: string
  trafficMultiplier: number
  latencyMultiplier: number
  propagationChance: number
}

export const INCIDENT_PROFILES: Record<string, IncidentProfile> = {
  ransomware: {
    type: 'ransomware',
    trafficMultiplier: 2.5,
    latencyMultiplier: 1.5,
    propagationChance: 0.3
  },
  ddos: {
    type: 'ddos',
    trafficMultiplier: 5.0,
    latencyMultiplier: 3.0,
    propagationChance: 0.1
  },
  degraded: {
    type: 'degraded',
    trafficMultiplier: 0.1, // packet loss drops traffic to 10%
    latencyMultiplier: 2.0,
    propagationChance: 0.0
  }
}

export interface NetworkDemand {
  nodeId: string
  demandGbps: number
  activeIncident?: string
}

export interface AdjacencyMap {
  nodeToConnections: Map<string, string[]>
  connectionMap: Map<string, Connection>
}
