import { Inspector } from './components/ui/Inspector'
import { Dashboard } from './components/ui/Dashboard'
import { GlobalNetwork } from './components/ui/GlobalNetwork'
import { Scene } from './components/world/Scene'
import { useInfraStore } from './store/useInfraStore'
import { useState, useMemo, useEffect } from 'react'
import { Terminal } from './components/ui/Terminal'
import { OperatorHandbook } from './components/ui/OperatorHandbook'

import { TopNav } from './components/ui/TopNav'
import { ProcurementMenu } from './components/ui/ProcurementMenu'
import { MissionHUD } from './components/ui/MissionHUD'
import { EmergencyOperationsCenter } from './components/ui/EmergencyOperationsCenter'
import { IncidentHUD } from './components/ui/IncidentHUD'
import { ApplicationBrowser } from './components/ui/ApplicationBrowser'
import { EconomyDashboard } from './components/ui/EconomyDashboard'
import { GlobalMap } from './components/ui/GlobalMap'
import { Rocket, X, TrendingUp, Sliders, LayoutGrid, Wind, Scaling, Box, Zap } from 'lucide-react'
import type { HardwareCatalogKey } from './physics/hardwareLibrary'
import { useHotkeys } from './hooks/useHotkeys'
import { THEMES } from './store/themeTypes'
import type { ThemeKey } from './store/themeTypes'
import { ToastProvider } from './components/ui/base'
import { audioManager } from './utils/AudioManager'
import { syncZoningWithStore } from './physics/zoning'

import { SaveManager } from './components/ui/SaveManager'

function App() {
  useHotkeys()
  const isSaveManagerOpen = useInfraStore(s => s.isSaveManagerOpen)
  const setIsSaveManagerOpen = (val: boolean) => useInfraStore.setState({ isSaveManagerOpen: val })
  const [hardwareToAdd, setHardwareToAdd] = useState<HardwareCatalogKey | null>(null)
  const [isNOCDashboardOpen, setIsNOCDashboardOpen] = useState(false)
  const [nocInitialTab, setNocInitialTab] = useState<'overview' | 'events' | 'audit' | 'diagnostics'>('overview')
  const [isProcurementOpen, setIsProcurementOpen] = useState(false)
  const [isHandbookOpen, setIsHandbookOpen] = useState(false)
  const [isAppBrowserOpen, setIsAppBrowserOpen] = useState(false)
  const [isEconomyOpen, setIsEconomyOpen] = useState(false)
  
  const nodes = useInfraStore(s => s.nodes)
  const balance = useInfraStore(s => s.balance)
  const reputation = useInfraStore(s => s.reputation)
  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const toggleGlobalMap = useInfraStore(s => s.toggleGlobalMap)

  const fixState = useInfraStore(s => s.fixState)

  useEffect(() => {
    fixState()
    useInfraStore.getState().initializeSimulation()
  }, [fixState])

  // Phase 10.2: Auto-Save System
  useEffect(() => {
    const timer = setInterval(() => {
      useInfraStore.getState().saveGame('auto')
    }, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(timer)
  }, [])

  const racks = useMemo(() => nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId), [nodes, currentSiteId])

  const placeCatalogHardware = useInfraStore((s) => s.placeCatalogHardware)
  const totalPowerKW = useInfraStore((s) => s.totalPowerKW)
  const totalRoomBTU = useInfraStore((s) => s.totalRoomBTU)
  const overloadedRackCount = useInfraStore((s) => s.overloadedRackCount)
  const {
    selectedNodeId,
    setIsTerminalOpen,
    isTerminalOpen,
    addTerminalSession,
    terminalStates,
    renderQuality,
    setRenderQuality,
    activeTheme,
    setTheme,
    facilityRowsCount,
    facilityColumnsCount,
    coolingZonesCount,
    powerBlocksCount,
    facilityWingsCount,
    hallWidthCount,
    hallLengthCount,
    expandFacilityRow,
    expandFacilityColumns,
    expandCoolingZone,
    expandPowerBlock,
    expandFacilityWing,
    expandHall,
    halls
  } = useInfraStore()

  const [isFacilityPanelOpen, setIsFacilityPanelOpen] = useState(false)

  // Dynamic Design Tokens DOM Injector
  useEffect(() => {
    const root = document.documentElement
    const themeSpec = THEMES[activeTheme]
    if (!themeSpec) return
    
    root.style.setProperty('--primary', themeSpec.primary)
    root.style.setProperty('--primary-glow', themeSpec.primaryGlow)
    root.style.setProperty('--accent', themeSpec.accent)
    root.style.setProperty('--accent-glow', themeSpec.accentGlow)
    root.style.setProperty('--bg-dark', themeSpec.bgDark)
    root.style.setProperty('--bg-deep', themeSpec.bgDeep)
    root.style.setProperty('--surface', themeSpec.surface)
    root.style.setProperty('--border', themeSpec.border)
    root.style.setProperty('--border-active', themeSpec.borderActive)
  }, [activeTheme])
  const setPlacementMode = useInfraStore((s) => s.setPlacementMode)
  const placementMode = useInfraStore((s) => s.placementMode)

  const setNetworkManagerOpen = useInfraStore(s => s.setNetworkManagerOpen)
  const pendingType = useInfraStore(s => s.pendingRackType)
  const cloudBurstingActive = useInfraStore(s => s.cloudBurstingActive)
  const activeCloudInstances = useInfraStore(s => s.activeCloudInstances)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && (e.target as HTMLElement).tagName !== 'INPUT') {
        setIsTerminalOpen(!isTerminalOpen)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isTerminalOpen, setIsTerminalOpen])

  useEffect(() => {
    const handleF2Key = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setNocInitialTab('diagnostics')
        setIsNOCDashboardOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleF2Key)
    return () => {
      window.removeEventListener('keydown', handleF2Key)
    }
  }, [])

  // Dynamic Grid Zoning Synchronization
  useEffect(() => {
    syncZoningWithStore(facilityRowsCount, facilityColumnsCount, halls)
  }, [facilityRowsCount, facilityColumnsCount, halls])


  useEffect(() => {
    if (placementMode && pendingType && pendingType !== 'RACK_42U') {
      const timer = setTimeout(() => setHardwareToAdd(pendingType as HardwareCatalogKey), 0)
      return () => clearTimeout(timer)
    } else if (!placementMode) {
      const timer = setTimeout(() => setHardwareToAdd(null), 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [placementMode, pendingType])

  const handleAddRack = () => {
    setPlacementMode(true, 'RACK_42U')
  }

  const handleConfirmPlacement = (rackId: string) => {
    if (!hardwareToAdd) return
    const success = placeCatalogHardware(hardwareToAdd, rackId)
    if (success) {
      setHardwareToAdd(null)
      useInfraStore.setState({ placementMode: false, pendingRackType: null })
    }
  }

  const siteTerminal = terminalStates[currentSiteId]

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#020617] font-sans text-slate-200">
      {/* 3D Scene Background */}
      <div className="fixed inset-0 z-0 cursor-crosshair">
        <Scene />
      </div>

      {/* Top Navigation Bar */}
      <TopNav 
        onOpenNetwork={() => setNetworkManagerOpen(!useInfraStore.getState().isNetworkManagerOpen)} 
        onToggleNOC={() => {
          setNocInitialTab('overview')
          setIsNOCDashboardOpen(!isNOCDashboardOpen)
        }}
        onToggleTerminal={() => {
           setIsTerminalOpen(!isTerminalOpen)
           if (siteTerminal && siteTerminal.sessions.length === 0) {
              addTerminalSession('Main Console')
           }
        }}
        onToggleEconomy={() => setIsEconomyOpen(!isEconomyOpen)}
        onToggleGlobalMap={toggleGlobalMap}
        onToggleEOC={() => useInfraStore.getState().toggleEoc()}
        onOpenHandbook={() => setIsHandbookOpen(!isHandbookOpen)}
        onToggleSaveManager={() => setIsSaveManagerOpen(!isSaveManagerOpen)}
        isTerminalOpen={isTerminalOpen}
      />

      <EmergencyOperationsCenter />

      {isSaveManagerOpen && (
        <SaveManager onClose={() => setIsSaveManagerOpen(false)} />
      )}
      
      <GlobalMap />

      {/* Professional Control Center */}
      <div className="fixed top-24 left-8 z-40 pointer-events-none">
        <div className={`pointer-events-auto glass-panel rounded-[1.5rem] p-4 transition-all duration-500 w-[240px] ${selectedNodeId ? 'translate-x-[-300px] opacity-0' : 'translate-x-0 opacity-100'}`}>
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-teal-400 flex items-center gap-1.5">
                <TrendingUp className="w-2.5 h-2.5" /> Command
              </p>
              <p className="text-[7px] text-slate-500 font-bold uppercase mt-0.5">Site Telemetry</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] text-teal-500/50 font-black uppercase">Live</span>
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white/5 rounded-xl p-2 border border-white/5">
              <p className="text-[6px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Capital</p>
              <p className="text-[10px] font-black text-emerald-400">${balance.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2 border border-white/5">
              <p className="text-[6px] text-slate-500 font-black uppercase tracking-widest leading-none mb-1">Trust</p>
              <p className="text-[10px] font-black text-amber-400">{reputation}%</p>
            </div>
          </div>
          
          <div className="space-y-2.5 px-1 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">Load</span>
              <span className="text-[10px] font-black text-white">{totalPowerKW.toFixed(1)} kW</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">Thermal</span>
              <span className="text-[10px] font-black text-white">{totalRoomBTU.toLocaleString()} <span className="text-[7px] text-slate-500 font-normal">BTU</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">Status</span>
              <span className={`text-[9px] font-black ${overloadedRackCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {overloadedRackCount > 0 ? 'FAILURES' : 'NOMINAL'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-white/5 mt-1.5">
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                <Sliders className="w-2.5 h-2.5 text-teal-400" /> GPU LOD
              </span>
              <select 
                value={renderQuality}
                onChange={(e) => setRenderQuality(e.target.value as 'ultra' | 'auto' | 'low')}
                className="bg-slate-900/90 text-white font-bold text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/10 outline-none cursor-pointer focus:border-teal-500 hover:bg-slate-800 transition-colors"
              >
                <option value="ultra">Ultra (No LOD)</option>
                <option value="auto">Auto (Dynamic)</option>
                <option value="low">Low (Max Perf)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-white/5 mt-1.5">
              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                🎨 Theme
              </span>
              <select 
                value={activeTheme}
                onChange={(e) => {
                  const newTheme = e.target.value as ThemeKey
                  setTheme(newTheme)
                  audioManager.playEffect('click')
                }}
                className="bg-slate-900/90 text-white font-bold text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-white/10 outline-none cursor-pointer focus:border-teal-500 hover:bg-slate-800 transition-colors"
              >
                {Object.values(THEMES).map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-white/5 mt-2">
              <button
                onClick={() => {
                  setIsFacilityPanelOpen(!isFacilityPanelOpen)
                  audioManager.playEffect('click')
                }}
                className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 font-black text-[8px] uppercase tracking-widest transition-all ${
                  isFacilityPanelOpen 
                    ? 'bg-teal-500 text-[#0a1536] border-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
                    : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                🏗️ Facility Scaling
              </button>
            </div>
          </div>

          {cloudBurstingActive && (
            <div className="mb-4 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest block">Cloud Overflow</span>
                <span className="text-[7px] text-orange-400/50 font-bold">Hybrid scale-out active</span>
              </div>
              <span className="text-[10px] font-black text-orange-400">{activeCloudInstances} Nodes</span>
            </div>
          )}

          <div className="pt-4 border-t border-white/5">
            <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em] mb-3 text-center">Quick Access Links</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              {[
                { k: 'T', l: 'Terminal' },
                { k: 'R', l: 'Racks' },
                { k: 'Tab', l: 'Hardware' },
                { k: '^S', l: 'Quick Save' },
              ].map(hk => (
                <div key={hk.k} className="flex items-center gap-1.5 group/key cursor-help">
                  <div className="min-w-[18px] h-4 flex items-center justify-center bg-white/10 rounded-md border border-white/10 text-[8px] font-black text-teal-400 px-1 shadow-sm group-hover/key:bg-teal-500 group-hover/key:text-[#0a1536] transition-all">
                    {hk.k}
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight group-hover/key:text-white transition-colors">{hk.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`fixed bottom-8 z-[200] transition-all duration-500 ease-out ${selectedNodeId ? 'right-[656px]' : 'right-28'}`}>
        <button 
          onClick={() => setIsAppBrowserOpen(!isAppBrowserOpen)}
          aria-label={isAppBrowserOpen ? "Close Application Browser" : "Open Application Browser"}
          className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 glass-panel hover:scale-105 active:scale-95 ${isAppBrowserOpen ? 'border-blue-500/50 rotate-90 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-blue-500/30 hover:border-blue-500/60'}`}
        >
          {isAppBrowserOpen ? (
            <X className="w-7 h-7 text-blue-400" />
          ) : (
            <Rocket className="w-7 h-7 text-blue-400" />
          )}
        </button>
      </div>

      <ProcurementMenu 
        onAddRack={handleAddRack}
        isOpen={isProcurementOpen}
        onToggle={setIsProcurementOpen}
      />

      {/* 🏗️ Facility Orchestration Control Panel Drawer */}
      <div className={`fixed top-24 bottom-8 right-8 z-[210] pointer-events-none transition-all duration-500 transform ${isFacilityPanelOpen ? 'translate-x-0 opacity-100' : 'translate-x-[450px] opacity-0'}`}>
        <div className="pointer-events-auto w-[360px] h-full glass-panel rounded-[2rem] p-6 flex flex-col justify-between">
          <div>
            {/* Title / Header */}
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-400">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-tight text-white uppercase">Facility Architecture</h3>
                  <p className="text-[7px] text-slate-500 font-bold uppercase mt-0.5">DCIM Infrastructure Orchestrator</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsFacilityPanelOpen(false)
                  audioManager.playEffect('click')
                }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Live Infrastructure Telemetry Summary */}
            <div className="bg-slate-950/60 rounded-[1.5rem] p-4 border border-white/5 mb-6 space-y-3">
              <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest block mb-2 px-1">Hall Status</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-[7px] text-slate-500 font-black block uppercase mb-1">Dimensions</span>
                  <span className="text-xs font-black text-white">{hallWidthCount}m x {hallLengthCount}m</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-[7px] text-slate-500 font-black block uppercase mb-1">Grid Area</span>
                  <span className="text-xs font-black text-white">{hallWidthCount * hallLengthCount} sq m</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-[7px] text-slate-500 font-black block uppercase mb-1">Row Capacity</span>
                  <span className="text-xs font-black text-white">{facilityRowsCount} Rows</span>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-[7px] text-slate-500 font-black block uppercase mb-1">Slots / Row</span>
                  <span className="text-xs font-black text-white">{facilityColumnsCount} Slots</span>
                </div>
              </div>
            </div>

            {/* Expansion Actions List */}
            <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1 custom-scrollbar">
              {[
                {
                  n: 'Commission Server Row',
                  d: 'Adds a new physical deployment row with automatic overhead rails, busways, and support hangers.',
                  c: 50000,
                  icon: LayoutGrid,
                  action: expandFacilityRow,
                  metric: `${facilityRowsCount} Active Rows`
                },
                {
                  n: 'Expand Rack Lanes',
                  d: 'Increases structural slot columns along the aisles to accommodate wider deployments.',
                  c: 40000,
                  icon: Scaling,
                  action: expandFacilityColumns,
                  metric: `Max column span: ${facilityColumnsCount}`
                },
                {
                  n: 'Expand Hall Footprint',
                  d: 'Increases concrete wall perimeter boundaries and raised modular tile grid by +10 meters.',
                  c: 80000,
                  icon: Box,
                  action: expandHall,
                  metric: `${hallWidthCount}x${hallLengthCount}m Hall`
                },
                {
                  n: 'Add Cooling Zone Block',
                  d: 'Commissions secondary CRAC ventilation manifolds to improve operational heat dissipation.',
                  c: 30000,
                  icon: Wind,
                  action: expandCoolingZone,
                  metric: `${coolingZonesCount} Cooling Zones`
                },
                {
                  n: 'Add UPS Power Block',
                  d: 'Integrates secondary high-capacity battery bank racks and electrical transformer heads.',
                  c: 40000,
                  icon: Zap,
                  action: expandPowerBlock,
                  metric: `${powerBlocksCount} UPS Modules`
                },
                {
                  n: 'Construct Facility Wing',
                  d: 'Constructs an adjacent colocation hall wing to prepare the campus for large enterprise scaling.',
                  c: 100000,
                  icon: Rocket,
                  action: expandFacilityWing,
                  metric: `${facilityWingsCount} Campus Wings`
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-teal-400 mt-0.5">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-white uppercase">{item.n}</h4>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{item.metric}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-500 font-semibold mb-3 leading-relaxed">{item.d}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-[10px] font-black text-emerald-400">${item.c.toLocaleString()}</span>
                    <button
                      onClick={() => {
                        item.action()
                      }}
                      className="px-4 py-2 bg-teal-500 hover:bg-teal-400 active:scale-95 text-[#020617] rounded-xl text-[8px] font-black uppercase tracking-wider transition-all"
                    >
                      Purchase
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Telemetry */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-slate-500 text-[8px] font-black uppercase tracking-wider">
            <span>Enterprise Campus v5.2</span>
            <span className="text-teal-500">Authorized Access Only</span>
          </div>
        </div>
      </div>

      <ToastProvider />
      {isNOCDashboardOpen && (
        <Dashboard 
          key={nocInitialTab}
          initialTab={nocInitialTab} 
          onClose={() => setIsNOCDashboardOpen(false)} 
        />
      )}
      <GlobalNetwork />
      <MissionHUD />
      <IncidentHUD />

      <Inspector />
      <ApplicationBrowser 
        isOpen={isAppBrowserOpen}
        onClose={() => setIsAppBrowserOpen(false)}
      />

      <EconomyDashboard 
        isOpen={isEconomyOpen}
        onClose={() => setIsEconomyOpen(false)}
      />
      {isTerminalOpen && <Terminal onClose={() => setIsTerminalOpen(false)} />}
      {isHandbookOpen && <OperatorHandbook onClose={() => setIsHandbookOpen(false)} />}

      {placementMode && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-teal-500 text-[#020617] px-8 py-4 rounded-2xl border-2 border-white/20 shadow-[0_20px_50px_rgba(20,184,166,0.3)] backdrop-blur-md font-black text-xs uppercase tracking-widest animate-bounce">
          Select target location on grid to deploy rack
        </div>
      )}

      {totalRoomBTU > 50000 && (
        <div className="fixed bottom-24 left-8 z-40 bg-red-600/20 border border-red-500/50 text-red-500 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.3)] backdrop-blur-md font-black text-xs uppercase tracking-[0.2em] animate-pulse flex items-center gap-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <p>Thermal Critical</p>
            <p className="text-[9px] text-red-400/70 mt-1">Cooling capacity exceeded</p>
          </div>
        </div>
      )}

      {hardwareToAdd && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#020617]/90 backdrop-blur-xl p-4">
          <div className="bg-[#0a1536] border border-white/10 p-8 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] max-w-md w-full">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-teal-500/20 rounded-2xl flex items-center justify-center text-2xl">🏗️</div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase">Deployment Target</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Select rack for installation</p>
              </div>
            </div>

            {racks.length === 0 ? (
              <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl text-center mb-8">
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No Racks Detected</p>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Please deploy a server rack before installing hardware components.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-72 overflow-y-auto mb-8 pr-2 custom-scrollbar">
                {racks.map(rack => (
                  <button 
                    key={rack.id}
                    onClick={() => handleConfirmPlacement(rack.id)}
                    className="group p-5 text-left bg-white/5 hover:bg-teal-500/10 border border-white/5 hover:border-teal-500/30 rounded-2xl transition-all flex justify-between items-center"
                  >
                    <div>
                      <p className="font-black text-white text-sm tracking-tight">{rack.name.toUpperCase()}</p>
                      <p className="text-[9px] text-slate-500 font-bold tracking-widest mt-1">SN: {rack.id.slice(0,12).toUpperCase()}</p>
                    </div>
                    <div className="w-8 h-8 bg-white/5 group-hover:bg-teal-500 group-hover:text-[#020617] rounded-lg flex items-center justify-center transition-all">
                      <span className="text-xs font-black">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={() => setHardwareToAdd(null)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
