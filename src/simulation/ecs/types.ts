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
  // Dynamic network incident & state variables
  degradation?: number
  healthStatus?: string
  isInfected?: boolean
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
}

// Thermal Component: Heat dynamics state
export interface ThermalComponent extends Component {
  temperature: number
  isThrottled: boolean
  fanSpeedPercent: number
  btuOutput: number
  lastUpdate: number
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
}

// Provisioning Component: OS/App lifecycle state
export interface ProvisioningComponent extends Component {
  state: 'unboxed' | 'racked' | 'patched' | 'bootstrapped' | 'provisioned'
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
  raidLevel: 'RAID0' | 'RAID1' | 'RAID5' | 'RAID10' | 'JBOD'
  storageStatus: 'healthy' | 'degraded' | 'rebuilding' | 'failed'
  rebuildProgress: number
  driveDegradation: number
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
