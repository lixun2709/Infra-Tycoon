import type { InfraNode, ApplicationDeployment } from '../../store/infraTypes'

export type SimMessageType = 
  | 'INIT' 
  | 'TICK' 
  | 'SYNC_INPUT' 
  | 'SYNC_OUTPUT' 
  | 'TELEMETRY'
  | 'PING'
  | 'PONG'

export interface SimMessage {
  type: SimMessageType
  payload?: any
}

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
    systemState: string
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
