import type { SystemState, Connection, TechnicianTicket, Incident, AutomationPolicy } from '../../store/infraTypes'
import type { TraceSpan } from '../observability/types'

export type SimMessageType = 
  | 'INIT' 
  | 'TICK' 
  | 'SYNC_INPUT' 
  | 'SYNC_OUTPUT' 
  | 'TELEMETRY'
  | 'PING'
  | 'PONG'
  | 'TERMINAL_CMD'

export interface CompactNode {
  id: string
  name?: string
  type: string
  siteId: string
  parentRackId?: string
  slotIndex?: number
  uHeight?: number
  wattage: number
  catalogKey?: string
  maxPowerKW?: number
  currentPowerKW?: number
  status?: string
  systemState: string
  breakerTripped?: boolean
  overloadSeconds?: number
  feedSource?: 'A' | 'B' | 'both'
  provisioningState: 'unboxed' | 'racked' | 'patched' | 'bootstrapped' | 'provisioned' | 'decommissioning'
  bootProgress: number
  temperature?: number
  isThrottled?: boolean
  btuOutput: number
  humidity?: number
  containmentType?: 'none' | 'cold_aisle' | 'hot_aisle'
  blankingPanels?: boolean[]
  phase?: 'A' | 'B' | 'C'
  dualPSU?: boolean
  pduFeeds?: 'A' | 'A+B'
  isStandby?: boolean
  accumulatedSimTime?: number
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
  physicalUsedStorageTB?: number
  writeAmplificationFactor?: number
  fanSpeedPercent?: number
  degradationPercent?: number
  healthStatus?: string
  isBlackholed?: boolean
  rateLimitGbps?: number
  maintenanceMode?: boolean
  backupStatus?: 'protected' | 'unprotected' | 'backing_up'
  lastBackupTime?: number
  corruptionState?: 'clean' | 'corrupted' | 'ransomware'
  infectionState?: 'clean' | 'exposed' | 'infected' | 'encrypting' | 'locked'
  isIsolated?: boolean
  microsegmentationEnabled?: boolean
  firmwareVersion?: string
  isFlashing?: boolean
}

export interface CompactApplication {
  id: string
  appId: string
  nodeId: string
  status: 'deploying' | 'running' | 'error'
  progress: number
  loadBalancerId?: string
  targetGroupIds?: string[]
}

export interface CompactContract {
  id: string
  blueprintId: string
  totalTicks: number
  uptimeTicks: number
  accumulatedPenalty: number
  currentStatus: 'healthy' | 'violating'
}

export interface CompactPod {
  id: string
  nodeId: string
  clusterId: string
  status: 'pending' | 'running' | 'terminating' | 'crashloop'
  cpuReq: number
  memoryReq: number
  serviceName: string
}

export interface CompactVirtualMachine {
  id: string
  nodeId: string
  status: 'powered_off' | 'booting' | 'running' | 'migrating' | 'error'
  cpuCores: number
  memoryGB: number
  storageGB: number
  migratingToNodeId?: string
  migrationProgress?: number
}

export interface SimInitPayload {
  nodes: CompactNode[]
  applications: CompactApplication[]
  contracts: CompactContract[]
  virtualMachines: CompactVirtualMachine[]
  pods: CompactPod[]
  connections: Connection[]
  networkLoad: number
  tickets: TechnicianTicket[]
  incidents: Incident[]
  automationPolicies: AutomationPolicy[]
  globalTargetFirmware: string
}

export interface SimSyncInputPayload {
  nodes: CompactNode[]
  applications: CompactApplication[]
  contracts: CompactContract[]
  virtualMachines: CompactVirtualMachine[]
  pods: CompactPod[]
  connections: Connection[]
  networkLoad: number
  tickets: TechnicianTicket[]
  incidents: Incident[]
  automationPolicies: AutomationPolicy[]
  globalTargetFirmware: string
}

export interface SimSyncOutputPayload {
  nodes: Array<{
    id: string
    temperature: number
    isThrottled: boolean
    currentPowerKW: number
    bootProgress: number
    systemState?: SystemState
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
    physicalUsedStorageTB?: number
    writeAmplificationFactor?: number
    fanSpeedPercent?: number
    breakerTripped?: boolean
    overloadSeconds?: number
    feedSource?: 'A' | 'B' | 'both'
    wattage?: number
    humidity?: number
    containmentType?: 'none' | 'cold_aisle' | 'hot_aisle'
    isStandby?: boolean
    accumulatedSimTime?: number
    infectionState?: 'clean' | 'exposed' | 'infected' | 'encrypting' | 'locked'
    infectionProgress?: number
    isIsolated?: boolean
    isBlackholed?: boolean
    backupStatus?: 'protected' | 'unprotected' | 'backing_up'
    lastBackupTime?: number
    corruptionState?: 'clean' | 'corrupted' | 'ransomware'
    coolingMethod?: 'air' | 'liquid_dlc' | 'immersion'
    waterFlowLPM?: number
    firmwareVersion?: string
    isFlashing?: boolean
  }>
  applications: Array<{
    id: string
    status: string
    progress: number
  }>
  virtualMachines?: Array<{
    id: string
    nodeId: string
    status: 'powered_off' | 'booting' | 'running' | 'migrating' | 'error'
    migratingToNodeId?: string
    migrationProgress?: number
  }>
  contracts: Array<{
    id: string
    totalTicks: number
    uptimeTicks: number
    accumulatedPenalty: number
    currentStatus: 'healthy' | 'violating'
  }>
  connections: Connection[]
  siteAmbientTemps?: Record<string, number>
  siteAmbientHumidity?: Record<string, number>
  alerts?: Array<{
    severity: 'info' | 'warning' | 'critical'
    message: string
    nodeId?: string
  }>
  racks?: Array<{
    id: string
    status: 'online' | 'power_overload'
    maxPowerKW: number
    currentPowerKW: number
    totalWeightKG?: number
    maxWeightKG?: number
  }>
  overloadedRackCount?: number
  siteMetricsHistory?: Record<string, {
    power: number[]
    temp: number[]
    humidity: number[]
  }>
  tickets?: TechnicianTicket[]
  incidents?: Incident[]
  firedAutomationPolicies?: { id: string, firedAt: number, nodeId?: string }[]
}

export interface SimTelemetryPayload {
  tickDurationMs: number
  entityCount: number
  lastTickTime: number
  systemTimings: Record<string, number>
  queryTelemetry?: {
    activeQueries: number
    queryHits: number
    queryMisses: number
    cacheHitRatio: number
  }
  simStats?: {
    averageUptimeRatio: number
    overheatedNodeCount: number
    congestedLinkCount: number
    totalPowerDrawKW: number
    totalStorageUsedTB: number
    totalStorageCapacityTB: number
    pue: number
    wue: number
  }
  spans?: TraceSpan[]
}

export interface SimTerminalCmdPayload {
  action: string
  targetId?: string
  siteId?: string
  args?: string[]
}

export type SimMessage = 
  | { type: 'INIT'; payload: SimInitPayload }
  | { type: 'SYNC_INPUT'; payload: SimSyncInputPayload }
  | { type: 'TICK'; payload?: { dt: number } }
  | { type: 'FACILITY_FEED'; payload: { feed: 'A' | 'B'; status: boolean } }
  | { type: 'SYNC_OUTPUT'; payload: SimSyncOutputPayload }
  | { type: 'TELEMETRY'; payload: SimTelemetryPayload }
  | { type: 'TERMINAL_CMD'; payload: SimTerminalCmdPayload }
  | { type: 'PING'; payload?: undefined }
  | { type: 'PONG'; payload?: undefined }
