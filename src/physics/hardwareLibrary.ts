export type HardwareCatalogSpec = {
  uHeight: number
  wattage: number
  type: 'compute' | 'storage' | 'backup' | 'network' | 'cooling' | 'load_balancer' | 'rack' | 'security' | 'identity' | 'facility'
  color: string
  purchasePrice: number
  portLayout: PortLayoutItem[]
  btuOutput?: number
  storageTB: number
  name: string
  isBlade?: boolean
  isBladeChassis?: boolean
  useCase: string
  maxOperatingTemp?: number
  throttleTemp?: number
  heatEfficiency?: number // 0-1, how much power becomes heat.
  minLevel?: number
  maxPowerKW?: number
  maxWeightKG?: number
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
    color: '#3a86ff',
    purchasePrice: 2000,
    storageTB: 0,
    isBladeChassis: true,
    useCase: 'High-density hosting environment for blade servers. Consolidates power and networking.',
    minLevel: 3,
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
    color: '#83c5be',
    purchasePrice: 400,
    storageTB: 1,
    isBlade: true,
    useCase: 'Modular compute node. Requires a Blade Chassis for power and connectivity.',
    minLevel: 3,
    portLayout: [
      { type: 'network', count: 2, labelPrefix: 'vnic' },
    ],
  },
  GPU_NODE_2U: {
    name: 'GPU Node (2U)',
    uHeight: 2,
    wattage: 1200,
    type: 'compute',
    color: '#10b981',
    purchasePrice: 3500,
    storageTB: 4,
    useCase: 'Specialized for AI/ML workloads and heavy graphical processing tasks.',
    maxOperatingTemp: 95,
    throttleTemp: 85,
    heatEfficiency: 0.95,
    minLevel: 4,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 4, labelPrefix: 'eth' },
    ],
  },
  H100_AI_NODE_4U: {
    name: 'H100 AI SuperNODE (4U)',
    uHeight: 4,
    wattage: 10200, // 10.2kW for 8x H100
    type: 'compute',
    color: '#059669', // Emerald 600
    purchasePrice: 250000,
    storageTB: 30, // Local NVMe
    useCase: 'Massive parallel compute for LLM training. Requires direct liquid cooling and Infiniband networking to avoid severe thermal throttling and latency penalties.',
    maxOperatingTemp: 90,
    throttleTemp: 80,
    heatEfficiency: 0.98, // Almost all power becomes heat
    minLevel: 5,
    portLayout: [
      { type: 'power', count: 1, labelPrefix: 'pwr' },
      { type: 'network', count: 48, labelPrefix: 'port' },
      { type: 'network', count: 4, labelPrefix: 'uplink' }
    ]
  },
  INFINIBAND_SWITCH_1U: {
    name: 'Infiniband Fabric Switch (1U)',
    uHeight: 1,
    wattage: 800,
    type: 'network',
    color: '#eab308', // Yellow 500
    purchasePrice: 25000,
    storageTB: 0,
    useCase: 'Ultra-low latency, 400Gbps switch required for bridging AI SuperNODEs into cohesive training clusters.',
    minLevel: 5,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
      { type: 'network', count: 32, labelPrefix: 'ib' },
      { type: 'network', count: 4, labelPrefix: 'uplink' }
    ]
  },
  COMPUTE_1U: {
    name: 'Compute (1U)',
    uHeight: 1,
    wattage: 300,
    type: 'compute',
    color: '#00b4d8',
    purchasePrice: 500,
    storageTB: 2,
    useCase: 'General purpose application server for web, database, or API services.',
    maxOperatingTemp: 80,
    throttleTemp: 70,
    heatEfficiency: 0.8,
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
    color: '#3f37c9',
    purchasePrice: 2500,
    storageTB: 50,
    useCase: 'The intelligence layer for SAN storage. Manages LUNs, snapshots, and replication.',
    minLevel: 2,
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
    color: '#48cae4',
    purchasePrice: 800,
    storageTB: 200,
    useCase: 'Capacity expansion for SAN. Provides bulk storage for data-heavy applications.',
    minLevel: 2,
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
    color: '#0077b6',
    purchasePrice: 4000,
    storageTB: 100,
    useCase: 'Ultra-low latency storage for high-performance databases and real-time analytics.',
    minLevel: 4,
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
    color: '#f72585',
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
    color: '#7209b7',
    purchasePrice: 2500,
    storageTB: 0,
    useCase: 'Core network backplane. Interconnects leaf switches for high-speed site fabric.',
    minLevel: 2,
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
    color: '#b5179e',
    purchasePrice: 1200,
    storageTB: 0,
    useCase: 'Enables secure remote access and encrypted site-to-site connectivity.',
    minLevel: 2,
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
    color: '#ef233c',
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
    color: '#d90429',
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
    color: '#f77f00',
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
    color: '#ffb703',
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
    color: '#fb8500',
    purchasePrice: 5000,
    storageTB: 0,
    useCase: 'Dedicated hardware for cryptographic key management and digital signatures.',
    minLevel: 5,
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
    color: '#ff9f1c',
    purchasePrice: 300,
    storageTB: 0,
    useCase: 'Upgrades rack power capacity to 15kW. Essential for high-density deployments.',
    minLevel: 2,
    portLayout: [
      { type: 'power', count: 24, labelPrefix: 'out' },
    ],
  },
  ENV_SENSOR: {
    name: 'Environmental Sensor',
    uHeight: 0,
    wattage: 5,
    type: 'facility',
    color: '#e9ff70',
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
    color: '#80ffdb',
    purchasePrice: 5000,
    storageTB: 0,
    useCase: 'High-capacity cooling unit. Reduces rack temperature by neutralizing BTU load.',
    maxOperatingTemp: 60,
    throttleTemp: 50,
    heatEfficiency: 0.2, // Low heat generation itself
    minLevel: 3,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
    ],
  },
  IN_ROW_COOLER: {
    name: 'In-Row Air Cooler (8U)',
    uHeight: 8,
    wattage: 8000,
    btuOutput: -120000,
    type: 'cooling',
    color: '#34d399',
    purchasePrice: 12000,
    storageTB: 0,
    useCase: 'High-density air cooling for contained aisles.',
    maxOperatingTemp: 60,
    throttleTemp: 50,
    heatEfficiency: 0.1,
    minLevel: 4,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
    ],
  },
  LIQUID_CDU: {
    name: 'DLC Coolant Distribution Unit (8U)',
    uHeight: 8,
    wattage: 3000,
    btuOutput: -250000,
    type: 'cooling',
    color: '#0ea5e9',
    purchasePrice: 25000,
    storageTB: 0,
    useCase: 'Direct Liquid Cooling (DLC) distribution unit. Supports high-density liquid-cooled racks.',
    maxOperatingTemp: 70,
    throttleTemp: 60,
    heatEfficiency: 0.05,
    minLevel: 5,
    portLayout: [
      { type: 'power', count: 2, labelPrefix: 'pwr' },
    ],
  },

  // --- BASE ---
  RACK_42U: {
    name: 'Server Rack (42U)',
    uHeight: 42,
    wattage: 0,
    type: 'rack',
    color: '#2d3748',
    purchasePrice: 200,
    storageTB: 0,
    useCase: 'Standard enterprise rack. Provides 42U of mounting space for hardware.',
    portLayout: [],
    maxPowerKW: 5.0,
    maxWeightKG: 1000,
  },
  RACK_48U_HIGH_DENSITY: {
    name: 'High-Density Rack (48U)',
    uHeight: 48,
    wattage: 0,
    type: 'rack',
    color: '#1a202c',
    purchasePrice: 800,
    storageTB: 0,
    useCase: 'Taller rack designed for high-density setups. Supports 48U and heavier loads.',
    portLayout: [],
    minLevel: 3,
    maxPowerKW: 15.0,
    maxWeightKG: 2000,
  },
  RACK_LIQUID_COOLED: {
    name: 'DLC Rack (42U)',
    uHeight: 42,
    wattage: 0,
    type: 'rack',
    color: '#0369a1',
    purchasePrice: 4500,
    storageTB: 0,
    useCase: 'Specialized Direct Liquid Cooling rack. Massively increases power density limits.',
    portLayout: [],
    minLevel: 5,
    maxPowerKW: 30.0,
    maxWeightKG: 1500,
    heatEfficiency: 0.1, // dissipates 90% of heat directly
  }
} as const satisfies Record<string, HardwareCatalogSpec>

export type HardwareCatalogKey = keyof typeof HARDWARE_CATALOG
