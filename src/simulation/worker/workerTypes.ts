import type { InfraNode, ApplicationDeployment, SystemState } from '../../store/infraTypes'

export type SimMessageType = 
  | 'INIT' 
  | 'TICK' 
  | 'SYNC_INPUT' 
  | 'SYNC_OUTPUT' 
  | 'TELEMETRY'
  | 'PING'
  | 'PONG'

export interface SimInitPayload {
  nodes: InfraNode[]
  applications: ApplicationDeployment[]
}

export interface SimSyncInputPayload {
  nodes: InfraNode[]
  applications: ApplicationDeployment[]
}

export interface SimSyncOutputPayload {
  nodes: Array<{
    id: string
    temperature: number
    isThrottled: boolean
    currentPowerKW: number
    bootProgress: number
    systemState: SystemState
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
}

export type SimMessage = 
  | { type: 'INIT'; payload: SimInitPayload }
  | { type: 'SYNC_INPUT'; payload: SimSyncInputPayload }
  | { type: 'TICK'; payload?: undefined }
  | { type: 'SYNC_OUTPUT'; payload: SimSyncOutputPayload }
  | { type: 'TELEMETRY'; payload: SimTelemetryPayload }
  | { type: 'PING'; payload?: undefined }
  | { type: 'PONG'; payload?: undefined }
