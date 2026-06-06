export const EventCategory = {
  SIMULATION: 'SIMULATION',
  GAMEPLAY: 'GAMEPLAY',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  TELEMETRY: 'TELEMETRY',
  INCIDENT: 'INCIDENT',
  MISSION: 'MISSION',
  TERMINAL: 'TERMINAL',
  UI: 'UI'
}

export type EventSeverity = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

export interface BaseEvent {
  id: string
  timestamp: number
  category: EventCategory
  type: string
  source: string
  severity: EventSeverity
}

// Specific Event Payloads
export interface SimulationTickEvent extends BaseEvent {
  category: 'SIMULATION'
  type: 'SIMULATION_TICK'
  payload: { deltaMs: number, currentTick: number }
}

export interface HardwareDeployedEvent extends BaseEvent {
  category: 'INFRASTRUCTURE'
  type: 'HARDWARE_DEPLOYED'
  payload: { nodeId: string, hardwareType: string, siteId: string }
}

export interface ThermalCriticalEvent extends BaseEvent {
  category: 'INCIDENT'
  type: 'THERMAL_CRITICAL'
  payload: { nodeId: string, temperatureC: number, maxTempC: number }
}

export interface PowerOverloadEvent extends BaseEvent {
  category: 'INCIDENT'
  type: 'POWER_OVERLOAD'
  payload: { rackId: string, currentDrawKW: number, maxCapacityKW: number }
}

export interface ContractCompletedEvent extends BaseEvent {
  category: 'GAMEPLAY'
  type: 'CONTRACT_COMPLETED'
  payload: { contractId: string, payout: number, reputationChange: number }
}

export interface TerminalCommandEvent extends BaseEvent {
  category: 'TERMINAL'
  type: 'TERMINAL_COMMAND'
  payload: { command: string, success: boolean, siteId: string, targetNode?: string }
}

export interface UINotificationEvent extends BaseEvent {
  category: 'UI'
  type: 'UI_NOTIFICATION'
  payload: { message: string, severity: string, nodeId?: string }
}

export type AppEvent = 
  | SimulationTickEvent 
  | HardwareDeployedEvent 
  | ThermalCriticalEvent 
  | PowerOverloadEvent
  | ContractCompletedEvent
  | TerminalCommandEvent
  | UINotificationEvent
  | (BaseEvent & { payload?: any }) // Fallback for dynamically dispatched events

export type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void

export type EventCategory = keyof typeof EventCategory
