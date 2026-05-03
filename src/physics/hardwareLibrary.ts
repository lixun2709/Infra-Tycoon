export type HardwareCatalogSpec = {
  uHeight: number
  wattage: number
  type: 'compute' | 'storage' | 'backup' | 'network' | 'cooling' | 'load_balancer' | 'rack' | 'security' | 'identity' | 'facility'
  color: string
  purchasePrice: number
  portLayout: PortLayoutItem[]
  btuOutput?: number
  storageTB: number
  name?: string
  isBlade?: boolean
  isBladeChassis?: boolean
  useCase: string
}

export type PortType = 'power' | 'network' | 'fc' | 'sas'

export type PortLayoutItem = {
  type: PortType
  count: number
  labelPrefix: string
}

export const HARDWARE_CATALOG = {
  // --- COMPUTE ---
  BLADE_CHASSIS_4U: {
    name: 'Blade Chassis (4U)',
    uHeight: 4,
    wattage: 500,
    type: 'compute',
    color: '#555555',
    purchasePrice: 2000,
    storageTB: 0,
    isBladeChassis: true,
    useCase: 'High-density hosting environment for blade servers. Consolidates power and networking.',
    portLayout: [
      { type: 'power', count: 4, labelPrefix: 'pwr' },
      { type: 'network', count: 8, labelPrefix: 'fabric' },
    ],
  },
  BLADE_SERVER: {
    name: 'Blade Server',
    uHeight: 0, // Fits inside chassis
    wattage: 200,
    type: 'compute',
    color: '#777777',
    purchasePrice: 400,
    storageTB: 1,
    isBlade: true,
    useCase: 'Modular compute node. Requires a Blade Chassis for power and connectivity.',
    portLayout: [
      { type: 'network', count: 2, labelPrefix: 'vnic' },
    ],
  },
  GPU_NODE_2U: {
    name: 'GPU Node (2U)',
    uHeight: 2,
    wattage: 1200,
    type: 'compute',
    color: '#32CD32',
    purchasePrice: 3500,
    storageTB: 4,
    useCase: 'Specialized for AI/ML workloads and heavy graphical processing tasks.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'eth' },
    ],
  },
  COMPUTE_1U: {
    name: 'Compute (1U)',
    uHeight: 1,
    wattage: 300,
    type: 'compute',
    color: '#4A4A4A',
    purchasePrice: 500,
    storageTB: 2,
    useCase: 'General purpose application server for web, database, or API services.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 3, labelPrefix: 'eth' },
    ],
  },

  // --- STORAGE ---
  SAN_CONTROLLER_2U: {
    name: 'SAN Controller (2U)',
    uHeight: 2,
    wattage: 600,
    type: 'storage',
    color: '#0067B1',
    purchasePrice: 2500,
    storageTB: 50,
    useCase: 'The intelligence layer for SAN storage. Manages LUNs, snapshots, and replication.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'fc' },
    ],
  },
  DISK_SHELF_2U: {
    name: 'Disk Shelf (2U)',
    uHeight: 2,
    wattage: 300,
    type: 'storage',
    color: '#1E90FF',
    purchasePrice: 800,
    storageTB: 200,
    useCase: 'Capacity expansion for SAN. Provides bulk storage for data-heavy applications.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'fc', count: 2, labelPrefix: 'sas' },
    ],
  },
  NVME_ARRAY_1U: {
    name: 'NVMe Flash Array (1U)',
    uHeight: 1,
    wattage: 400,
    type: 'storage',
    color: '#00BFFF',
    purchasePrice: 4000,
    storageTB: 100,
    useCase: 'Ultra-low latency storage for high-performance databases and real-time analytics.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 2, labelPrefix: 'eth' },
    ],
  },

  // --- NETWORKING ---
  LEAF_SWITCH_1U: {
    name: 'Leaf Switch (1U)',
    uHeight: 1,
    wattage: 150,
    type: 'network',
    color: '#9370DB',
    purchasePrice: 400,
    storageTB: 0,
    useCase: 'Top-of-Rack connectivity. Links individual servers to the site backbone.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 48, labelPrefix: 'Gi1/0/' },
    ],
  },
  SPINE_SWITCH_2U: {
    name: 'Spine Switch (2U)',
    uHeight: 2,
    wattage: 400,
    type: 'network',
    color: '#4B0082',
    purchasePrice: 2500,
    storageTB: 0,
    useCase: 'Core network backplane. Interconnects leaf switches for high-speed site fabric.',
    portLayout: [
      { type: 'power', count: 4, labelPrefix: 'pwr' },
      { type: 'network', count: 32, labelPrefix: 'Hu1/0/' },
    ],
  },
  VPN_GATEWAY_1U: {
    name: 'VPN Gateway (1U)',
    uHeight: 1,
    wattage: 100,
    type: 'network',
    color: '#8A2BE2',
    purchasePrice: 1200,
    storageTB: 0,
    useCase: 'Enables secure remote access and encrypted site-to-site connectivity.',
    portLayout: [
      { type: 'power', count: 1, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'eth' },
    ],
  },

  // --- SECURITY ---
  NG_FIREWALL_1U: {
    name: 'NG-Firewall (1U)',
    uHeight: 1,
    wattage: 200,
    type: 'security',
    color: '#B22222',
    purchasePrice: 1800,
    storageTB: 0,
    useCase: 'Layer 7 inspection. Protects the network from advanced threats and malware.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 6, labelPrefix: 'eth' },
    ],
  },
  SIEM_COLLECTOR_1U: {
    name: 'SIEM Collector (1U)',
    uHeight: 1,
    wattage: 250,
    type: 'security',
    color: '#8B0000',
    purchasePrice: 1500,
    storageTB: 10,
    useCase: 'Centralized log management and security event correlation for threat detection.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 2, labelPrefix: 'eth' },
    ],
  },
  IDS_IPS_NODE_2U: {
    name: 'IDS/IPS Node (2U)',
    uHeight: 2,
    wattage: 300,
    type: 'security',
    color: '#FF4500',
    purchasePrice: 1600,
    storageTB: 0,
    useCase: 'Active intrusion prevention. Monitors and blocks suspicious network traffic.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'eth' },
    ],
  },

  // --- IDENTITY ---
  DIRECTORY_SERVER_1U: {
    name: 'Directory Server (1U)',
    uHeight: 1,
    wattage: 200,
    type: 'identity',
    color: '#FFD700',
    purchasePrice: 1200,
    storageTB: 1,
    useCase: 'Manages user identities, authentication (AD/LDAP), and access control lists.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 2, labelPrefix: 'eth' },
    ],
  },
  HSM_MODULE_1U: {
    name: 'HSM Module (1U)',
    uHeight: 1,
    wattage: 150,
    type: 'identity',
    color: '#DAA520',
    purchasePrice: 5000,
    storageTB: 0,
    useCase: 'Dedicated hardware for cryptographic key management and digital signatures.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 2, labelPrefix: 'eth' },
    ],
  },

  // --- FACILITIES ---
  HIGH_DENSITY_PDU_1U: {
    name: 'High-Density PDU (1U)',
    uHeight: 1,
    wattage: 50,
    type: 'facility',
    color: '#FF8C00',
    purchasePrice: 300,
    storageTB: 0,
    useCase: 'Upgrades rack power capacity to 15kW. Essential for high-density deployments.',
    portLayout: [
      { type: 'power', count: 24, labelPrefix: 'out' },
    ],
  },
  ENV_SENSOR: {
    name: 'Environmental Sensor',
    uHeight: 0,
    wattage: 5,
    type: 'facility',
    color: '#ADFF2F',
    purchasePrice: 150,
    storageTB: 0,
    useCase: 'Enables thermal heat-map visualization. Tracks rack temperature and humidity.',
    portLayout: [],
  },
  IN_ROW_CRAC_4U: {
    name: 'In-Row CRAC (4U)',
    uHeight: 4,
    wattage: 5000,
    btuOutput: -50000,
    type: 'cooling',
    color: '#00FFFF',
    purchasePrice: 5000,
    storageTB: 0,
    useCase: 'High-capacity cooling unit. Reduces rack temperature by neutralizing BTU load.',
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
    ],
  },

  // --- BASE ---
  RACK_42U: {
    uHeight: 42,
    wattage: 0,
    type: 'rack',
    color: '#2d3748',
    purchasePrice: 200,
    storageTB: 0,
    useCase: 'Standard enterprise rack. Provides 42U of mounting space for hardware.',
    portLayout: [],
  }
} as const satisfies Record<string, HardwareCatalogSpec>

export type HardwareCatalogKey = keyof typeof HARDWARE_CATALOG
