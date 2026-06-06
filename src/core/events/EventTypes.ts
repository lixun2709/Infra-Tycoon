export enum EventCategory {
  SIMULATION = 'SIMULATION',
  GAMEPLAY = 'GAMEPLAY',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  TELEMETRY = 'TELEMETRY',
  INCIDENT = 'INCIDENT',
  MISSION = 'MISSION',
  TERMINAL = 'TERMINAL',
  UI = 'UI'
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
  category: EventCategory.SIMULATION
  type: 'SIMULATION_TICK'
  payload: { deltaMs: number, currentTick: number }
}

export interface HardwareDeployedEvent extends BaseEvent {
  category: EventCategory.INFRASTRUCTURE
  type: 'HARDWARE_DEPLOYED'
  payload: { nodeId: string, hardwareType: string, siteId: string }
}

export interface ThermalCriticalEvent extends BaseEvent {
  category: EventCategory.INCIDENT
  type: 'THERMAL_CRITICAL'
  payload: { nodeId: string, temperatureC: number, maxTempC: number }
}

export interface PowerOverloadEvent extends BaseEvent {
  category: EventCategory.INCIDENT
  type: 'POWER_OVERLOAD'
  payload: { rackId: string, currentDrawKW: number, maxCapacityKW: number }
}

export interface ContractCompletedEvent extends BaseEvent {
  category: EventCategory.GAMEPLAY
  type: 'CONTRACT_COMPLETED'
  payload: { contractId: string, payout: number, reputationChange: number }
}

export type AppEvent = 
  | SimulationTickEvent 
  | HardwareDeployedEvent 
  | ThermalCriticalEvent 
  | PowerOverloadEvent
  | ContractCompletedEvent
  | (BaseEvent & { payload?: any }) // Fallback for dynamically dispatched events

export type EventHandler<T extends AppEvent = AppEvent> = (event: T) => void
