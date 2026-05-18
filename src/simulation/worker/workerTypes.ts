import type { SystemState } from '../../store/infraTypes'

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
  type: string
  siteId: string
  parentRackId?: string
  slotIndex?: number
  wattage: number
  currentPowerKW?: number
  systemState: string
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
}

export interface SimSyncInputPayload {
  nodes: CompactNode[]
  applications: CompactApplication[]
}

export interface SimSyncOutputPayload {
  nodes: Array<{
    id: string
    temperature: number
    isThrottled: boolean
    currentPowerKW: number
    bootProgress: number
    systemState: SystemState
    totalStorageTB?: number
    usedStorageTB?: number
    raidLevel?: 'RAID0' | 'RAID1' | 'RAID5' | 'RAID10' | 'JBOD'
    storageStatus?: 'healthy' | 'degraded' | 'rebuilding' | 'failed'
    rebuildProgress?: number
    ioPSLimit?: number
    ioPSUsed?: number
    driveDegradation?: number
  }>
  applications: Array<{
    id: string
    status: string
    progress: number
  }>
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
}

export type SimMessage = 
  | { type: 'INIT'; payload: SimInitPayload }
  | { type: 'SYNC_INPUT'; payload: SimSyncInputPayload }
  | { type: 'TICK'; payload?: undefined }
  | { type: 'SYNC_OUTPUT'; payload: SimSyncOutputPayload }
  | { type: 'TELEMETRY'; payload: SimTelemetryPayload }
  | { type: 'PING'; payload?: undefined }
  | { type: 'PONG'; payload?: undefined }
