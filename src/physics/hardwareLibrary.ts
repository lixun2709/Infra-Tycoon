export type HardwareCatalogSpec = {
  uHeight: number
  wattage: number
  type: 'compute' | 'storage' | 'backup' | 'network'
  color: string
  portLayout: PortLayoutItem[]
}

export type PortType = 'power' | 'network' | 'fc' | 'sas'

export type PortLayoutItem = {
  type: PortType
  count: number
  labelPrefix: string
}

export const HARDWARE_CATALOG = {
  COMPUTE_1U: {
    uHeight: 1,
    wattage: 300,
    type: 'compute',
    color: '#4a5568',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'eth' },
      { type: 'fc', count: 2, labelPrefix: 'fc' },
    ],
  },
  NETAPP_STORAGE_2U: {
    uHeight: 2,
    wattage: 600,
    type: 'storage',
    color: '#2b6cb0',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'fc', count: 4, labelPrefix: 'sfp28' },
      { type: 'sas', count: 2, labelPrefix: 'sas' },
    ],
  },
  RUBRIK_BACKUP_2U: {
    uHeight: 2,
    wattage: 550,
    type: 'backup',
    color: '#805ad5',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'eth' },
      { type: 'fc', count: 2, labelPrefix: 'fc' },
    ],
  },
  SWITCH_1U: {
    uHeight: 1,
    wattage: 150,
    type: 'network',
    color: '#2d3748',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 48, labelPrefix: 'eth' },
    ],
  },
} as const satisfies Record<string, HardwareCatalogSpec>

export type HardwareCatalogKey = keyof typeof HARDWARE_CATALOG
