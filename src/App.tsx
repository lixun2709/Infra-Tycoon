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
import { MissionLogic } from './components/world/MissionLogic'
import { ApplicationBrowser } from './components/ui/ApplicationBrowser'
import { EconomyDashboard } from './components/ui/EconomyDashboard'
import { GlobalMap } from './components/ui/GlobalMap'
import { PerformanceOverlay } from './components/ui/PerformanceOverlay'
import { Rocket, X, TrendingUp } from 'lucide-react'
import type { HardwareCatalogKey } from './physics/hardwareLibrary'
import { useHotkeys } from './hooks/useHotkeys'
import type { InfraAlert } from './store/infraTypes'

function EmergencyToasts() {
  const alerts = useInfraStore(s => s.alerts)
  const [activeAlert, setActiveAlert] = useState<InfraAlert | null>(null)

  useEffect(() => {
    if (alerts.length === 0) return

    const latest = alerts[alerts.length - 1]
    if (Date.now() - latest.timestamp < 6000) {
      // Async update to satisfy React purity/cascading rules
      const timerId = setTimeout(() => {
        setActiveAlert(latest)
      }, 0)
      
      const clearTimer = setTimeout(() => {
        setActiveAlert(null)
      }, 6000)
      
      return () => {
        clearTimeout(timerId)
        clearTimeout(clearTimer)
      }
    }
    return undefined
  }, [alerts])

  if (!activeAlert) return null

  const isCritical = activeAlert.severity === 'critical'
  const isWarning = activeAlert.severity === 'warning'

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none transition-all">
      <div className={`bg-[#0a1536]/95 backdrop-blur-xl border rounded-xl px-6 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-4 max-w-xl w-max ring-4 ${isCritical ? 'border-red-500 ring-red-900/30' : (isWarning ? 'border-amber-500 ring-amber-900/30' : 'border-teal-500 ring-teal-900/30')}`}>
        <div className="text-4xl animate-bounce drop-shadow-lg">{isCritical ? '🚨' : (isWarning ? '⚠️' : '💾')}</div>
        <div className="flex-1">
          <h2 className={`text-sm font-black tracking-widest uppercase mb-1 drop-shadow-sm ${isCritical ? 'text-red-500' : (isWarning ? 'text-amber-500' : 'text-teal-400')}`}>
            {isCritical ? 'Critical Failure' : (isWarning ? 'Action Denied' : 'System Sync')}
          </h2>
          <p className={`font-semibold text-sm leading-snug ${isCritical ? 'text-red-100' : (isWarning ? 'text-amber-100' : 'text-teal-100')}`}>
            {activeAlert.message}
          </p>
        </div>
      </div>
    </div>
  )
}

import { SaveManager } from './components/ui/SaveManager'

function App() {
  useHotkeys()
  const isSaveManagerOpen = useInfraStore(s => s.isSaveManagerOpen)
  const setIsSaveManagerOpen = (val: boolean) => useInfraStore.setState({ isSaveManagerOpen: val })
  const [hardwareToAdd, setHardwareToAdd] = useState<HardwareCatalogKey | null>(null)
  const [isNOCDashboardOpen, setIsNOCDashboardOpen] = useState(false)
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
    terminalStates
  } = useInfraStore()
  const setPlacementMode = useInfraStore((s) => s.setPlacementMode)
  const placementMode = useInfraStore((s) => s.placementMode)
  const processAutoBackups = useInfraStore((s) => s.processAutoBackups)
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

    const interval = setInterval(() => {
      useInfraStore.getState().processTick()
    }, 2000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isTerminalOpen, setIsTerminalOpen])

  useEffect(() => {
    const interval = setInterval(() => {
      processAutoBackups()
    }, 15000)
    return () => clearInterval(interval)
  }, [processAutoBackups])

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
        onToggleNOC={() => setIsNOCDashboardOpen(!isNOCDashboardOpen)}
        onToggleTerminal={() => {
           setIsTerminalOpen(!isTerminalOpen)
           if (siteTerminal && siteTerminal.sessions.length === 0) {
              addTerminalSession('Main Console')
           }
        }}
        onToggleEconomy={() => setIsEconomyOpen(!isEconomyOpen)}
        onToggleGlobalMap={toggleGlobalMap}
        onOpenHandbook={() => setIsHandbookOpen(!isHandbookOpen)}
        onToggleSaveManager={() => setIsSaveManagerOpen(!isSaveManagerOpen)}
        isTerminalOpen={isTerminalOpen}
      />

      {isSaveManagerOpen && (
        <SaveManager onClose={() => setIsSaveManagerOpen(false)} />
      )}
      
      <GlobalMap />

      {/* Professional Control Center */}
      <div className="fixed top-20 left-8 z-40 pointer-events-none">
        <div className={`pointer-events-auto bg-[#0a1536]/90 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] p-4 shadow-2xl transition-all w-[250px] ${selectedNodeId ? 'translate-x-[-300px] opacity-0' : 'translate-x-0 opacity-100'}`}>
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

      <div className="fixed bottom-8 right-32 z-[200]">
        <button 
          onClick={() => setIsAppBrowserOpen(!isAppBrowserOpen)}
          aria-label={isAppBrowserOpen ? "Close Application Browser" : "Open Application Browser"}
          className={`relative w-20 h-20 rounded-[2.5rem] flex items-center justify-center transition-all shadow-2xl ${isAppBrowserOpen ? 'bg-slate-800 rotate-90' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          {isAppBrowserOpen ? (
            <X className="text-white w-8 h-8" />
          ) : (
            <Rocket className="text-white w-8 h-8" />
          )}
        </button>
      </div>

      <ProcurementMenu 
        onAddRack={handleAddRack}
        isOpen={isProcurementOpen}
        onToggle={setIsProcurementOpen}
      />
      <PerformanceOverlay />

      <EmergencyToasts />
      {isNOCDashboardOpen && <Dashboard onClose={() => setIsNOCDashboardOpen(false)} />}
      <GlobalNetwork />
      <MissionHUD />
      <MissionLogic />

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
