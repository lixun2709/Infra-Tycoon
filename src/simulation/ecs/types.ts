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
  // Dynamic network incident & state variables
  degradation?: number
  healthStatus?: string
  isInfected?: boolean
  isBlackholed?: boolean
  rateLimitGbps?: number
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
  humidity?: number            // Relative Humidity % (0 - 100)
  containmentType?: 'none' | 'cold_aisle' | 'hot_aisle' // Airflow containment configuration
  isStandby?: boolean         // Standby state for CRAC units under N+1 redundancy
  accumulatedSimTime?: number  // Deterministic time tracking counter (seconds)
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
  phase?: 'A' | 'B' | 'C'        // Phase connection for server nodes
  phaseLoadsWatts?: [number, number, number] // [A, B, C] Real Power
  phaseLoadsVA?: [number, number, number]    // [A, B, C] Apparent Power
  systemState?: 'off' | 'booting' | 'running'
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
  powerHistory?: number[]
  tempHistory?: number[]
  iopsHistory?: number[]
}

// Rack Component: Power capacity, status, and physical slot layout
export interface RackComponent extends Component {
  maxPowerKW: number
  currentPowerKW: number
  status: 'online' | 'power_overload'
  hasHighDensityPDU: boolean
  slotOccupancy: boolean[]
}

export type ComponentMap<T extends Component> = Map<Entity, T>
