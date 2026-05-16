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
}

// Thermal Component: Heat dynamics state
export interface ThermalComponent extends Component {
  temperature: number
  isThrottled: boolean
  btuOutput: number
  lastUpdate: number
}

// Power Component: Electrical state
export interface PowerComponent extends Component {
  wattage: number
  load: number
  isPowered: boolean
  efficiency: number
}

// Provisioning Component: OS/App lifecycle state
export interface ProvisioningComponent extends Component {
  state: 'unboxed' | 'racked' | 'patched' | 'bootstrapped' | 'provisioned'
  bootProgress: number
}

export interface ApplicationComponent extends Component {
  appId: string
  status: 'deploying' | 'running' | 'error'
  progress: number
}

export type ComponentMap<T extends Component> = Map<Entity, T>
