/**
 * ECS Core Types
 * Entities are unique identifiers. Components are data containers.
 */

export type Entity = string

export interface Component {
  entityId: Entity
}

// Transform Component: Spatial and Hierarchy data
export interface TransformComponent extends Component {
  siteId: string
  parentRackId?: string
  slotIndex?: number
  type: string
  name?: string
  catalogKey?: string
  uHeight?: number
  position?: { x: number; y: number; z: number }
  // Dynamic network incident & state variables
  degradation?: number
  healthStatus?: string
  isBlackholed?: boolean
  rateLimitGbps?: number
  maintenanceMode?: boolean
  isThrottled?: boolean
}

// Connection Component: Network link state
export interface ConnectionComponent extends Component {
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
  type?: string
  packetLoss?: number
  // V2/Enterprise Additions
  controlQueueDelayMs?: number // Delay for latency-sensitive control traffic
  bulkQueueDelayMs?: number    // Delay for bulk storage/backup transfers
  packetsDropped?: number      // Count of packets dropped on this link
  isBlackholed?: boolean       // Administrative null route toggle
  rateLimitGbps?: number       // Speed ceiling for this link
}

// Thermal Component: Heat dynamics state
export interface ThermalComponent extends Component {
  temperature: number
  isThrottled: boolean
  fanSpeedPercent: number
  btuOutput: number
  lastUpdate: number
  // V2/Enterprise Additions
  startTimestamp?: number
  humidity?: number            // Relative Humidity % (0 - 100)
  containmentType?: 'none' | 'cold_aisle' | 'hot_aisle' // Airflow containment configuration
  isStandby?: boolean         // Standby state for CRAC units under N+1 redundancy
  accumulatedSimTime?: number  // Deterministic time tracking counter (seconds)
  coolingMethod?: 'air' | 'liquid_dlc' | 'immersion'
  waterFlowLPM?: number // Liters per minute consumed/circulated by cooling unit
}

// Power Component: Electrical state
export interface PowerComponent extends Component {
  wattage: number
  load: number
  isPowered: boolean
  efficiency: number
  breakerTripped?: boolean
  overloadSeconds?: number
  feedSource?: 'A' | 'B' | 'both'
  baseWattage?: number
  // V2/Enterprise Additions
  powerFactor?: number
  apparentPowerVA?: number
  upsBatterySeconds?: number     // Current battery backup charge (seconds)
  upsMaxBatterySeconds?: number  // Maximum battery capacity (default: 30s)
  lastUpsAlertSecond?: number    // Tracks last fired UPS alert to prevent event flooding
  phase?: 'A' | 'B' | 'C'        // Phase connection for server nodes
  phaseLoadsWatts?: [number, number, number] // [A, B, C] Real Power
  phaseLoadsVA?: [number, number, number]    // [A, B, C] Apparent Power
  systemState?: 'off' | 'booting' | 'running'
  gridLossDrill?: boolean
}

// Provisioning Component: OS/App lifecycle state
export interface ProvisioningComponent extends Component {
  state: 'unboxed' | 'racked' | 'patched' | 'bootstrapped' | 'provisioned' | 'decommissioning'
  bootProgress: number
}

export interface ApplicationComponent extends Component {
  appId: string
  nodeId: string
  status: 'deploying' | 'running' | 'error'
  progress: number
}

// Storage Component: Physical array configuration, RAID status, and IOPS loading
export interface StorageComponent extends Component {
  totalStorageTB: number
  usedStorageTB: number
  ioPSLimit: number
  ioPSUsed: number
  raidLevel: 'RAID0' | 'RAID1' | 'RAID5' | 'RAID6' | 'RAID10' | 'JBOD'
  storageStatus: 'healthy' | 'degraded' | 'highly_degraded' | 'rebuilding' | 'failed'
  rebuildProgress: number
  driveDegradation: number
  tier?: 'hdd' | 'ssd' | 'nvme'
  failedDrives?: number
  replicationSourceId?: string
  replicationProgress?: number
  baseTotalStorageTB?: number
  baseUsedStorageTB?: number
  baseIoPSLimit?: number
  deduplicationEnabled?: boolean
  compressionEnabled?: boolean
  deduplicationRatio?: number
  compressionRatio?: number
  physicalUsedStorageTB?: number
  writeAmplificationFactor?: number
}

import type { CircularBuffer } from '../../utils/CircularBuffer'

// Telemetry Component: Per-entity performance and operational history
export interface TelemetryComponent extends Component {
  uptimeTicks: number
  totalTicks: number
  powerSpikesCount: number
  thermalThrottlingTicks: number
  networkCongestionTicks: number
  storageIopsThrottlingTicks: number
  auditViolationsCount: number
  // V2/Enterprise rolling history ring buffers
  powerHistory?: CircularBuffer
  tempHistory?: CircularBuffer
  iopsHistory?: CircularBuffer
}

// Rack Component: Power capacity, status, and physical slot layout
export interface RackComponent extends Component {
  maxPowerKW: number
  currentPowerKW: number
  status: 'online' | 'power_overload'
  hasHighDensityPDU: boolean
  slotOccupancy: boolean[]
  blankingPanels?: boolean[]
  // V2/Enterprise Additions
  totalWeightKG?: number
  maxWeightKG?: number
  weightStatus?: 'nominal' | 'structural_warning' | 'seismic_hazard'
  pduTemperature?: number
  humidity?: number
  deratedMaxPowerKW?: number
  hasPhaseImbalance?: boolean
  collisionOccupancy?: boolean[]
  hasSlotCollision?: boolean
  hasBoundaryViolation?: boolean
  centerOfGravityU?: number
  recirculationFactor?: number
}

export type ComponentMap<T extends Component> = Map<Entity, T>

// Contract Component: SLA and Billing tracking
export interface ContractComponent extends Component {
  blueprintId: string
  totalTicks: number
  uptimeTicks: number
  accumulatedPenalty: number
  currentStatus: 'healthy' | 'violating'
}

// Backup Component: Handles data protection and corruption states
export interface BackupComponent extends Component {
  backupStatus: 'protected' | 'unprotected' | 'backing_up'
  lastBackupTime: number
  backupTargetId?: string
  corruptionState?: 'clean' | 'corrupted' | 'ransomware'
  isImmutable?: boolean // Enterprise feature: cannot be corrupted by ransomware
}

// Security Component: Handles enterprise threat states like ransomware and lateral propagation
export interface SecurityComponent extends Component {
  infectionState: 'clean' | 'exposed' | 'infected' | 'encrypting' | 'locked'
  infectionProgress: number
  encryptionRate: number
  isIsolated: boolean
  isImmutable?: boolean // Cannot be encrypted
  microsegmentationEnabled?: boolean // Reduces lateral spread chance
  infectionType?: 'worm' | 'targeted' | 'zero_day'
}

// Hypervisor Component: Node-level ESXi properties
export interface HypervisorComponent extends Component {
  isESXi: boolean
  cpuOvercommitRatio: number
  memoryOvercommitRatio: number
}

// Ticket Component: Tracks active repair workflows
export interface TicketComponent extends Component {
  ticketId: string
  targetNodeId: string
  type: 'drive' | 'cpu' | 'motherboard' | 'psu' | 'network' | 'power'
  priority?: 'P1' | 'P2' | 'P3' | 'P4'
  elapsedSeconds: number
  totalSeconds: number
  status: 'queued' | 'dispatched' | 'arrived' | 'diagnosing' | 'repairing' | 'completed'
}

// Incident Component: Tracks site-wide or major events (Real or Drills)
export interface IncidentComponent extends Component {
  incidentId: string
  type: 'drill' | 'ransomware' | 'power_outage' | 'network_outage' | 'thermal_runaway' | 'hvac_drill' | 'power_drill'
  severity: 'low' | 'medium' | 'high' | 'critical'
  rootCause?: string // Root cause tracker
  affectedNodes: string[]
  elapsedSeconds: number
  rtoTargetSeconds?: number // Recovery Time Objective
  rpoTargetSeconds?: number // Recovery Point Objective (For Storage Replication)
  isResolved: boolean
  hasAlertedRto?: boolean
  siteId?: string
  startTimestamp?: number
  escalationLevel?: number
}

// VM Component: Individual Virtual Machine state running inside the ECS
export interface KubernetesNodeComponent extends Component {
  role: 'master' | 'worker'
  clusterId: string
  totalMasters?: number // Total masters configured for quorum calculation
  maxPods: number
  cpuCapacity: number
  memoryCapacity: number
  cpuAllocatable?: number
  memoryAllocatable?: number
  kubeletStatus: 'running' | 'degraded' | 'offline'
}

export interface PodComponent extends Component {
  nodeId: string
  clusterId: string
  status: 'pending' | 'running' | 'terminating' | 'crashloop' | 'oomkilled'
  cpuReq: number
  memoryReq: number
  memoryLimit?: number
  serviceName: string
  evictionTimer?: number
  restartCount?: number
}

export interface VmComponent extends Component {
  nodeId: string // The ESXi host ID
  status: 'powered_off' | 'booting' | 'running' | 'migrating' | 'error'
  cpuCores: number
  memoryGB: number
  storageGB: number
  migratingToNodeId?: string // Target node during vMotion
  migrationProgress?: number // 0-100
}
