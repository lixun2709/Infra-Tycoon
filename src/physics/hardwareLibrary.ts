export type HardwareCatalogSpec = {
  uHeight: number
  wattage: number
  type: 'compute' | 'storage' | 'backup' | 'network' | 'cooling' | 'load_balancer'
  color: string
  portLayout: PortLayoutItem[]
  btuOutput?: number
  storageTB: number
  name?: string
}

export type PortType = 'power' | 'network' | 'fc' | 'sas'

export type PortLayoutItem = {
  type: PortTypess
  count: number
  labelPrefix: string
}

export const HARDWARE_CATALOG = {
  COMPUTE_1U: {
    uHeight: 1,
    wattage: 300,
    type: 'compute',
    color: '#4a5568',
    storageTB: 2,
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
    storageTB: 100,
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
    storageTB: 200,
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
    storageTB: 0,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 48, labelPrefix: 'eth' },
    ],
  },
  CRAC_UNIT_4U: {
    uHeight: 4,
    wattage: 5000,
    btuOutput: -50000,
    type: 'cooling',
    color: '#38b2ac',
    storageTB: 0,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
    ],
  },
  LOAD_BALANCER_1U: {
    name: 'Layer 7 Load Balancer',
    uHeight: 1,
    wattage: 150,
    type: 'load_balancer',
    color: '#dd6b20',
    storageTB: 0,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 8, labelPrefix: 'eth' },
    ],
  }
} as const satisfies Record<string, HardwareCatalogSpec>

export type HardwareCatalogKey = keyof typeof HARDWARE_CATALOG
