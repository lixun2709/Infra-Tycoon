import type { Vector3 } from 'three'
import type { HardwareCatalogKey, PortType } from '../physics/hardwareLibrary'

export type ContractTier = 'SME' | 'Enterprise' | 'Government' | 'Research'

export interface ContractRequirement {
  appId: string
  count: number
  redundant?: boolean // Must be on different racks
  multiRegion?: boolean // Must be on different sites
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
  minLevel?: number
}

export type ReputationTier = 'Blacklisted' | 'Unproven' | 'Reliable' | 'Enterprise Trusted' | 'Mission Critical'

export interface ReputationHistoryEntry {
  id: string
  timestamp: number
  amount: number
  reason: string
}

// --- Automation Types ---

export type AutomationConditionType = 
  | 'temp_above' 
  | 'health_degraded' 
  | 'power_loss'
  | 'cpu_above'
  | 'memory_above'
  | 'hardware_failure'

export type AutomationActionType = 
  | 'reboot_node' 
  | 'shutdown_node' 
  | 'notify_only'
  | 'auto_dispatch_smart_hands'

export interface AutomationPolicy {
  id: string
  name: string
  enabled: boolean
  targetLevel: 'global' | 'site' | 'rack' | 'node' | 'application'
  targetId?: string // Optional specific target depending on level
  conditionType: AutomationConditionType
  conditionValue: number | string // e.g. 85 for temp, 'degraded' for health
  actionType: AutomationActionType
  cooldownMs: number // Cooldown to prevent spamming
  lastFiredAt: number
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

export type InfraNodeType = 'rack' | 'compute' | 'storage' | 'network' | 'backup' | 'cooling' | 'load_balancer' | 'security' | 'identity' | 'facility' | 'edge_cache'
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
  type: 'core' | 'edge'
  isDisaster: boolean
  region: string
  energySource: 'Renewable' | 'Grid'
  geoCoords: { lat: number; lng: number }
  ambientTemp?: number
}

export interface DatacenterHall {
  id: string
  x: number
  z: number
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
  totalWeightKG?: number
  maxWeightKG?: number
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
  deduplicationEnabled?: boolean
  compressionEnabled?: boolean
  deduplicationRatio?: number
  compressionRatio?: number
  heatEfficiency?: number
  physicalUsedStorageTB?: number
  writeAmplificationFactor?: number
  systemState: SystemState
  containmentType?: 'none' | 'cold_aisle' | 'hot_aisle'
  blankingPanels?: boolean[]
  coolingMethod?: 'air' | 'liquid_dlc' | 'immersion'
  waterFlowLPM?: number
  phase?: 'A' | 'B' | 'C'
  dualPSU?: boolean
  pduFeeds?: 'A' | 'A+B'
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
  // V2 network options
  isBlackholed?: boolean
  rateLimitGbps?: number
  hypervisorConfig?: {
    isESXi: boolean
    cpuOvercommitRatio: number
    memoryOvercommitRatio: number
    maxVms?: number
  }
  infectionState?: 'clean' | 'exposed' | 'infected' | 'encrypting' | 'locked'
  lastBackupTime?: number
  corruptionState?: 'clean' | 'corrupted' | 'ransomware'
  isIsolated?: boolean
  microsegmentationEnabled?: boolean
  firmwareVersion?: string
  isFlashing?: boolean
}

export interface VirtualMachine {
  id: string
  nodeId: string
  status: 'powered_off' | 'booting' | 'running' | 'migrating' | 'error'
  cpuCores: number
  memoryGB: number
  storageGB: number
  name: string
  guestOS?: string
  uptimeTicks?: number
  migratingToNodeId?: string
  migrationProgress?: number
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

export interface Incident {
  id: string
  siteId: string
  type: 'drill' | 'ransomware' | 'power_outage' | 'network_outage' | 'thermal_runaway' | 'hvac_drill' | 'power_drill'
  severity: 'low' | 'medium' | 'high' | 'critical'
  startTimestamp: number
  resolvedTimestamp?: number
  affectedNodes: string[]
  isResolved: boolean
  rtoTargetSeconds?: number
  elapsedSeconds: number
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

export interface PodData {
  id: string
  nodeId: string
  clusterId: string
  status: 'pending' | 'running' | 'terminating' | 'crashloop'
  cpuReq: number
  memoryReq: number
  serviceName: string
}

export type ApplicationDeployment = {
  id: string
  appId: string
  nodeId: string
  status: 'deploying' | 'running' | 'error'
  progress: number
  aiEpochs?: number
  aiFlopsDelivered?: number
  aiStatus?: 'training' | 'stalled' | 'completed'
  loadBalancerId?: string
  targetGroupIds?: string[]
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
  lengthMeters?: number
  mediaType?: 'copper_cat6' | 'dac_twinax' | 'mmf_om4' | 'smf_os2' | 'power_c13'
  cost?: number
  highlightTime?: number
  packetLoss?: number
  // V2/Enterprise Additions
  controlQueueDelayMs?: number
  bulkQueueDelayMs?: number
  packetsDropped?: number
  isBlackholed?: boolean
  rateLimitGbps?: number
  routingWeight?: number
}

export type TicketSeverity = 'P1' | 'P2' | 'P3' | 'P4'
export type SlaStatus = 'Healthy' | 'Approaching Breach' | 'Breached'

export interface TechnicianTicket {
  id: string
  nodeId: string
  nodeName: string
  type: 'drive' | 'cpu' | 'motherboard' | 'psu' | 'network' | 'power'
  status: 'queued' | 'dispatched' | 'arrived' | 'diagnosing' | 'repairing' | 'completed'
  elapsedSeconds: number
  totalSeconds: number
  cost: number
  progress: number
  severity: TicketSeverity
  slaTargetSeconds: number
  priorityFee?: number
  breachFinesAccumulated?: number
}

// v6.0 Banking & Debt
export interface BankLoan {
  id: string
  name: string
  principal: number
  remainingAmount: number
  interestRate: number // monthly interest rate (e.g. 0.05 for 5%)
  minimumMonthlyPayment: number
}
