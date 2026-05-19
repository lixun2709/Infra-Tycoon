import type { SystemState, Connection } from '../../store/infraTypes'

export type SimMessageType = 
  | 'INIT' 
  | 'TICK' 
  | 'SYNC_INPUT' 
  | 'SYNC_OUTPUT' 
  | 'TELEMETRY'
  | 'PING'
  | 'PONG'

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
  totalStorageTB?: number
  usedStorageTB?: number
  raidLevel?: 'RAID0' | 'RAID1' | 'RAID5' | 'RAID10' | 'JBOD'
  storageStatus?: 'healthy' | 'degraded' | 'rebuilding' | 'failed'
  rebuildProgress?: number
  ioPSLimit?: number
  ioPSUsed?: number
  driveDegradation?: number
  fanSpeedPercent?: number
  degradationPercent?: number
  healthStatus?: string
  isInfected?: boolean
}

export interface CompactApplication {
  id: string
  appId: string
  nodeId: string
  status: 'deploying' | 'running' | 'error'
  progress: number
}

export interface SimInitPayload {
  nodes: CompactNode[]
  applications: CompactApplication[]
  connections: Connection[]
  networkLoad: number
}

export interface SimSyncInputPayload {
  nodes: CompactNode[]
  applications: CompactApplication[]
  connections: Connection[]
  networkLoad: number
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
    raidLevel?: 'RAID0' | 'RAID1' | 'RAID5' | 'RAID10' | 'JBOD'
    storageStatus?: 'healthy' | 'degraded' | 'rebuilding' | 'failed'
    rebuildProgress?: number
    ioPSLimit?: number
    ioPSUsed?: number
    driveDegradation?: number
    fanSpeedPercent?: number
    breakerTripped?: boolean
    overloadSeconds?: number
    feedSource?: 'A' | 'B' | 'both'
    wattage?: number
  }>
  applications: Array<{
    id: string
    status: string
    progress: number
  }>
  connections: Connection[]
  siteAmbientTemps?: Record<string, number>
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
  }>
  overloadedRackCount?: number
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
  }
}

export type SimMessage = 
  | { type: 'INIT'; payload: SimInitPayload }
  | { type: 'SYNC_INPUT'; payload: SimSyncInputPayload }
  | { type: 'TICK'; payload?: { dt: number } }
  | { type: 'SYNC_OUTPUT'; payload: SimSyncOutputPayload }
  | { type: 'TELEMETRY'; payload: SimTelemetryPayload }
  | { type: 'PING'; payload?: undefined }
  | { type: 'PONG'; payload?: undefined }
