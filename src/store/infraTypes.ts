import type { Vector3 } from 'three'
import type { HardwareCatalogKey, PortType } from '../physics/hardwareLibrary'

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

export type InfraNodeType = 'rack' | 'compute' | 'storage' | 'network' | 'backup' | 'cooling' | 'load_balancer' | 'security' | 'identity' | 'facility'
export type RackStatus = 'online' | 'power_overload'
export type HealthStatus = 'healthy' | 'degraded' | 'critical'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type BackupStatus = 'protected' | 'unprotected' | 'backing_up'
export type DataCategory = 'Public' | 'Internal' | 'PII'
export type SystemState = 'off' | 'booting' | 'running'

export type InfraAlert = {
  id: string
  timestamp: number
  cycle?: number
  severity: AlertSeverity
  message: string
  isAcknowledged: boolean
  nodeId?: string
}

export type AuditLog = {
  id: string
  timestamp: number
  type: 'SovereigntyViolation' | 'ComplianceCheck' | 'LifecycleEvent'
  message: string
  sourceNodeId: string
  targetNodeId: string
  status: 'Blocked' | 'Allowed' | 'Info'
}

export type Site = {
  id: string
  name: string
  isDisaster: boolean
  region: string
  energySource: 'Renewable' | 'Grid'
  geoCoords: { lat: number; lng: number }
  ambientTemp?: number
}

export type HardwarePort = {
  id: string
  type: PortType
  label: string
  connectedTo: null | string
  status: 'up' | 'down' | 'negotiating'
  ip?: string
  mask?: string
  speedMbps?: number
  vlan?: number
}

export type ComponentHealth = {
  cpu: HealthStatus[]
  ram: HealthStatus[]
  drives: HealthStatus[]
}

export type ServiceType = 'web' | 'storage' | 'backup' | 'DHCP' | 'DNS' | 'NTP'
export type ServiceStatus = 'running' | 'stopped' | 'degraded'

export type NodeService = {
  id: string
  type: ServiceType
  status: ServiceStatus
  port: number
}

export interface InfraNode {
  id: string
  type: InfraNodeType
  siteId: string
  position: Vector3
  name: string
  uHeight: number
  wattage: number
  btuOutput: number
  parentRackId?: string
  slotIndex?: number
  catalogKey?: HardwareCatalogKey
  maxPowerKW?: number
  currentPowerKW?: number
  status?: RackStatus
  healthStatus?: HealthStatus
  backupStatus?: BackupStatus
  totalStorageTB?: number
  usedStorageTB?: number
  raidLevel?: 'RAID0' | 'RAID1' | 'RAID5' | 'RAID6' | 'RAID10' | 'JBOD'
  storageStatus?: 'healthy' | 'degraded' | 'highly_degraded' | 'rebuilding' | 'failed'
  rebuildProgress?: number
  tier?: 'hdd' | 'ssd' | 'nvme'
  failedDrives?: number
  replicationSourceId?: string
  replicationProgress?: number
  ioPSLimit?: number
  ioPSUsed?: number
  driveDegradation?: number
  systemState: SystemState
  bootProgress: number
  hostname?: string
  managementIP?: string
  macAddress?: string
  provisioningState: 'unboxed' | 'racked' | 'patched' | 'bootstrapped' | 'provisioned' | 'decommissioning'
  isConfigured?: boolean
  vlan?: number
  ports: HardwarePort[]
  services: NodeService[]
  assetTag?: string
  serialNumber?: string
  dataCategory?: DataCategory
  installDate: number
  installTimestamp?: number
  degradation: number
  temperature?: number
  isThrottled?: boolean
  fanSpeedPercent?: number
  isRefreshing?: boolean
  componentHealth?: ComponentHealth
  failureProbability?: number
  isImmutable?: boolean
  isInfected?: boolean
  lastMaintenance?: number
  provisioningProgress?: number
  maintenanceMode?: boolean
  activeMigration?: { targetNodeId: string; progress: number }
  ipmiConfig?: {
    ip?: string
    username?: string
    password?: string
    powerStatus: 'on' | 'off'
  }
  breakerTripped?: boolean
  overloadSeconds?: number
  feedSource?: 'A' | 'B' | 'both'
}

export interface PostMortem {
  id: string
  incidentNumber: number
  timestamp: number
  nodeName: string
  nodeId: string
  rca: string
  mitigation: string
  impact: string
}

export interface Blueprint {
  id: string
  name: string
  nodes: InfraNode[]
  connections: Connection[]
  createdAt: number
}

export interface DnsRecord {
  id: string
  hostname: string
  ip: string
  type: 'A' | 'CNAME' | 'MX'
}

export interface DhcpLease {
  id: string
  nodeId: string
  ip: string
  expires: number
}

export interface NtpSyncStatus {
  nodeId: string
  stratum: number
  offsetMs: number
  status: 'synced' | 'unsynced' | 'error'
}

export interface SaveMetadata {
  id: string
  timestamp: number
  siteName: string
  nodeCount: number
}

export type ApplicationDeployment = {
  id: string
  appId: string
  nodeId: string
  status: 'deploying' | 'running' | 'error'
  progress: number
}

export interface CloudLink {
  id: string
  nodeId: string
  tieredTB: number
}

export interface Connection {
  id: string
  startNodeId: string
  startPortId: string
  endNodeId: string
  endPortId: string
  bandwidthGbps: number
  throughputGbps: number
  latencyMs: number
  isBlockedByCompliance?: boolean
  status?: 'active' | 'blocked' | 'degraded'
  syncProgress?: number
  type?: PortType
  highlightTime?: number
  packetLoss?: number
}

export interface TechnicianTicket {
  id: string
  nodeId: string
  nodeName: string
  type: 'drive' | 'cpu' | 'motherboard' | 'psu'
  status: 'dispatched' | 'arrived' | 'diagnosing' | 'repairing' | 'completed'
  elapsedSeconds: number
  totalSeconds: number
  cost: number
}
