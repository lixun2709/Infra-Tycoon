export type HardwareCatalogSpec = {
  uHeight: number
  wattage: number
  type: 'compute' | 'storage' | 'backup' | 'network' | 'cooling' | 'load_balancer' | 'rack'
  color: string
  purchasePrice: number
  portLayout: PortLayoutItem[]
  btuOutput?: number
  storageTB: number
  name?: string
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
    color: '#4A4A4A',
    purchasePrice: 500,
    storageTB: 2,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 3, labelPrefix: 'eth' }, // eth0, eth1, eth2
    ],
  },
  NETAPP_STORAGE_2U: {
    uHeight: 2,
    wattage: 600,
    type: 'storage',
    color: '#0067B1',
    purchasePrice: 1100,
    storageTB: 100,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 3, labelPrefix: 'eth' }, // eth0, eth1, eth2
    ],
  },
  RUBRIK_BACKUP_2U: {
    uHeight: 2,
    wattage: 550,
    type: 'backup',
    color: '#E0E0E0',
    purchasePrice: 900,
    storageTB: 200,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 3, labelPrefix: 'eth' }, // eth0, eth1, eth2
    ],
  },
  SWITCH_1U: {
    uHeight: 1,
    wattage: 150,
    type: 'network',
    color: '#6A0DAD',
    purchasePrice: 350,
    storageTB: 0,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 24, labelPrefix: 'Gi1/0/' }, // Gi1/0/1 to Gi1/0/24
    ],
  },
  RACK_42U: {
    uHeight: 42,
    wattage: 0,
    type: 'rack',
    color: '#2d3748',
    purchasePrice: 200,
    storageTB: 0,
    portLayout: [],
  },
  CRAC_UNIT_4U: {
    uHeight: 4,
    wattage: 5000,
    btuOutput: -50000,
    type: 'cooling',
    color: '#38b2ac',
    purchasePrice: 2500,
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
    purchasePrice: 600,
    storageTB: 0,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 8, labelPrefix: 'eth' },
    ],
  }
} as const satisfies Record<string, HardwareCatalogSpec>

export type HardwareCatalogKey = keyof typeof HARDWARE_CATALOG
