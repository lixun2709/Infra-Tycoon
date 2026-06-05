import { Vector3 } from 'three'
import type { 
  InfraNode, 
  Connection, 
  CloudLink, 
  Site, 
  DatacenterHall,
  InfraAlert, 
  AuditLog, 
  DnsRecord, 
  DhcpLease, 
  NtpSyncStatus, 
  PostMortem, 
  Blueprint, 
  ApplicationDeployment,
  ServiceType,
  ServiceStatus,
  SaveMetadata,
  TechnicianTicket,
  VirtualMachine,
  Incident,
  BankLoan,
  ReputationHistoryEntry
} from './infraTypes'
import type { HardwareCatalogKey } from '../physics/hardwareLibrary'
import type { TerminalStateRecord } from './terminalTypes'
import type { SimSyncOutputPayload, SimTelemetryPayload } from '../simulation/worker/workerTypes'

import type { ThemeKey } from './themeTypes'
import type { CameraSlice } from './slices/cameraSlice'
import type { InteractionSlice } from './slices/interactionSlice'
import type { EconomySlice } from './slices/economySlice'
import type { ProgressionSlice } from './slices/progressionSlice'
import type { ContractBlueprint, ActiveContract } from '../physics/contractLibrary'
import type { MiscSlice } from './slices/miscSlice'
import type { StorageSlice } from './slices/storageSlice'
import type { AISlice } from './slices/aiSlice'

export type InfraState = {
  nodes: InfraNode[]
  connections: Connection[]
  cloudLinks: CloudLink[]
  cloudEgressGB: number
  totalPowerKW: number
  totalRoomBTU: number
  overloadedRackCount: number
  selectedNodeId: string | null
  patchingActive: boolean
  activePatchSource: { nodeId: string; portId: string } | null
  mousePosition: Vector3 | null
  sites: Site[]
  currentSiteId: string
  placementMode: boolean
  pendingRackType: string | null
  alerts: InfraAlert[]
  auditLogs: AuditLog[]
  isNetworkManagerOpen: boolean
  networkLoad: number
  resilienceIndex: number
  // v2.0 SDDC Metrics
  operationalBudget: number
  capacityUnits: number
  realTimePlayedSeconds: number
  dnsRecords: DnsRecord[]
  dhcpLeases: DhcpLease[]
  availableIPPool: string[]
  ntpSyncStatus: NtpSyncStatus[]
  networkUptime: number
  postMortems: PostMortem[]
  incidents: Incident[]
  blueprints: Blueprint[]
  previewBlueprintId: string | null
  siteMetricsHistory?: Record<string, {
    power: number[]
    temp: number[]
    humidity: number[]
  }>
  
  // v5.0 Service Layer
  applications: ApplicationDeployment[]
  virtualMachines: VirtualMachine[]
  technicianTickets: TechnicianTicket[]
  
  // Day 6: Enterprise Management Console
  terminalStates: Record<string, TerminalStateRecord>
  
  // v6.0 Economy & Progression
  balance: number
  reputation: number
  reputationHistory: ReputationHistoryEntry[]
  activeContracts: ActiveContract[]
  marketContracts: ContractBlueprint[]
  loans: BankLoan[]
  consecutiveNegativeMonths: number
  isBankrupt: boolean
  
  acceptContract: (blueprintId: string) => void
  cancelContract: (id: string) => void
  refreshMarketContracts: () => void
  takeLoan: (name: string, principal: number, interestRate: number, minimumMonthlyPayment: number) => void
  repayLoan: (id: string, amount: number) => void
  adjustReputation: (amount: number, reason: string) => void
  
  // v7.0 Global & Hybrid
  cloudBurstingActive: boolean
  activeCloudInstances: number
  setCloudBursting: (active: boolean) => void
  isGlobalMapOpen: boolean
  toggleGlobalMap: () => void
  assistantTargetId: string | null
  isAutoPilot: boolean
  renderQuality: 'ultra' | 'auto' | 'low'
  setRenderQuality: (quality: 'ultra' | 'auto' | 'low') => void
  activeTheme: ThemeKey
  setTheme: (theme: ThemeKey) => void
  timeFormat: '24h' | '12h'
  setTimeFormat: (format: '24h' | '12h') => void

  // Facility Scaling & Architecture
  facilityRowsCount: number
  facilityColumnsCount: number
  coolingZonesCount: number
  powerBlocksCount: number
  facilityWingsCount: number
  hallWidthCount: number
  hallLengthCount: number
  halls: DatacenterHall[]

  expandFacilityRow: () => void
  expandFacilityColumns: () => void
  expandCoolingZone: () => void
  expandPowerBlock: () => void
  expandFacilityWing: () => void
  expandHall: () => void
  expandHallDirection: (hx: number, hz: number, direction: 'N' | 'S' | 'E' | 'W') => void
  
  // Day 13: Cooling Optimization Gameplay
  upgradeRackContainment: (rackId: string, type: 'none' | 'cold_aisle' | 'hot_aisle') => void
  installBlankingPanels: (rackId: string) => void

  // Day 14: Power Distribution Architecture
  setServerPhase: (nodeId: string, phase: 'A' | 'B' | 'C') => void
  upgradeServerPSU: (nodeId: string) => void
  upgradeRackPDU: (rackId: string) => void
  toggleFacilityFeed: (feed: 'A' | 'B', status: boolean) => void

  // Day 5: Procurement & Thermal
  deploymentQueue: HardwareCatalogKey[]
  isHeatMapVisible: boolean
  toggleHeatMap: () => void
  saveSiteAsBlueprint: (name: string) => void
  applyBlueprint: (id: string) => void
  
  setNetworkLoad: (load: number) => void
  setNetworkManagerOpen: (open: boolean) => void
  setCurrentSiteId: (siteId: string) => void
  setMousePosition: (pos: Vector3 | null) => void
  acknowledgeAllAlerts: () => void
  pushAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId?: string) => void
  acknowledgeAlert: (id: string) => void
  simulateRandomFailure: () => void
  simulateDataCorruption: () => void
  // Day 29 Actions
  processAging: (dt: number) => void
  refreshHardware: (nodeId: string) => void
  repairHardware: (nodeId: string) => void
  toggleMaintenanceMode: (nodeId: string) => void
  installService: (nodeId: string, type: ServiceType) => void
  toggleService: (nodeId: string, serviceId: string, status: ServiceStatus) => void
  // Day 30 Actions
  processCommand: (text: string) => void
  generateFinalReport: () => { score: number, grade: string, breakdown: unknown }
  
  // Terminal Actions
  updateTerminalLayout: (layout: Partial<{ width: number; height: number; x: number; y: number; isMaximized: boolean }>) => void
  addTerminalSession: (title?: string, initialContext?: { mode: 'global' | 'ssh' | 'nano' | 'top', targetId: string | null }) => void
  closeTerminalSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  splitTerminalPane: (direction: 'vertical' | 'horizontal') => void
  setActivePane: (paneId: string) => void
  closeTerminalPane: (paneId: string) => void
  setTerminalAlias: (name: string, command: string) => void
  setTerminalEnvVar: (name: string, value: string) => void
  writeTerminalFile: (path: string, content: string) => void
  isTerminalOpen: boolean
  setIsTerminalOpen: (val: boolean) => void
  
  // v5.0 Service Layer Actions
  deployApplication: (appId: string, nodeId: string) => void
  removeApplication: (id: string) => void
  deployVirtualMachine: (vmId: string, nodeId: string, config: Omit<VirtualMachine, 'id' | 'nodeId' | 'status' | 'uptimeTicks'>) => void
  startVMotion: (vmId: string, targetNodeId: string) => void
  
  // Infrastructure Core Actions
  processTick: (dt?: number) => void
  
  setPlacementMode: (mode: boolean, type?: string | null) => void
  addNode: (node: InfraNode) => void
  placeCatalogHardware: (key: HardwareCatalogKey, targetRackId: string) => boolean
  setSelectedNode: (id: string | null) => void
  handlePortClick: (nodeId: string, portId: string) => void
  removeConnection: (id: string) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<InfraNode>) => void
  advanceProvisioningState: (id: string) => void
  isolateNode: (id: string) => void
  formatNode: (id: string) => void
  triggerRansomwareSimulation: () => void
  triggerDRDrill: (siteId?: string, severity?: 'low' | 'high') => void
  
  // Day 7: Logical Networking
  verifyService: (nodeId: string, type: ServiceType) => boolean
  patchConnection: (sNodeId: string, sPortId: string, tNodeId: string, tPortId: string) => void
  updateConnectionConfig: (id: string, config: Partial<Connection>) => void
  getServiceStatus: (type: ServiceType) => 'green' | 'red'
  setPreviewBlueprint: (id: string | null) => void
  exportToTerraform: () => string
  runComplianceCheck: () => { type: 'error' | 'warning'; message: string }[]
  ping: (sourceId: string, targetIp: string) => { success: boolean; message: string }
  
  // v1.6 Orchestration Actions
  addDnsRecord: (record: Omit<DnsRecord, 'id'>) => void
  removeDnsRecord: (id: string) => void
  autoPatchRack: (rackId: string) => void
  syncNtp: (nodeId: string) => void
  
  // v1.6 Logic Reset Actions
  powerOnNode: (nodeId: string) => void
  setNodeHostname: (nodeId: string, name: string) => void
  assignNetworkDetails: () => void
  checkNetworkPath: (startId: string, endId: string) => boolean
  getNetworkRoute: (startId: string, endId: string) => { exists: boolean; path: string[]; latencyMs: number; packetLoss: number; hops: number }
  resetState: () => void

  // ECS Sync
  getSimulationTelemetry: () => SimTelemetryPayload | null
  initializeSimulation: () => void
  handleWorkerOutput: (payload: SimSyncOutputPayload) => void

  // v2.0 Management Plane Additions
  isChaosMode: boolean
  validateReplication: (linkId: string) => boolean
  addReplicationLink: (sourceId: string) => void
  checkAllCompliance: () => void
  updateTerminalLogs: (sessionId: string, paneId: string, logs: string[]) => void
  finalRemoveNode: (id: string) => void
  visualizePath: (startId: string, endId: string) => void
  fixState: () => void
  resetRackBreaker: (rackId: string) => void

  // Phase 10: Save System
  saveGame: (slotId: string) => void
  loadGame: (slotId: string) => void
  getAvailableSaves: () => SaveMetadata[]
  isSaveManagerOpen: boolean
  updateSite: (id: string, updates: Partial<Site>) => void
} & CameraSlice & InteractionSlice & EconomySlice & ProgressionSlice & MiscSlice & StorageSlice & AISlice
