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
import { Rocket, X } from 'lucide-react'
import type { HardwareCatalogKey } from './physics/hardwareLibrary'

function EmergencyToasts() {
  const alerts = useInfraStore(s => s.alerts)
  const [activeAlert, setActiveAlert] = useState<typeof alerts[0] | null>(null)

  useEffect(() => {
    const popups = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning')
    if (popups.length === 0) return

    const latest = popups[0]
    if (Date.now() - latest.timestamp < 6000) {
      setActiveAlert(latest)
      const timer = setTimeout(() => {
        setActiveAlert(null)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [alerts])

  if (!activeAlert) return null

  const isCritical = activeAlert.severity === 'critical'

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none transition-all">
      <div className={`bg-[#1f0909]/95 border rounded-xl px-6 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-4 max-w-xl w-max ring-4 ${isCritical ? 'border-red-500 ring-red-900/30' : 'border-amber-500 ring-amber-900/30'}`}>
        <div className="text-4xl animate-bounce drop-shadow-lg">{isCritical ? '🚨' : '⚠️'}</div>
        <div className="flex-1">
          <h2 className={`text-sm font-black tracking-widest uppercase mb-1 drop-shadow-sm ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
            {isCritical ? 'Critical Failure' : 'Action Denied'}
          </h2>
          <p className={`font-semibold text-sm leading-snug ${isCritical ? 'text-red-100' : 'text-amber-100'}`}>
            {activeAlert.message}
          </p>
        </div>
      </div>
    </div>
  )
}



function App() {
  const [hardwareToAdd, setHardwareToAdd] = useState<HardwareCatalogKey | null>(null)
  const [isNOCDashboardOpen, setIsNOCDashboardOpen] = useState(false)
  const [isProcurementOpen, setIsProcurementOpen] = useState(false)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [isHandbookOpen, setIsHandbookOpen] = useState(false)
  const [isAppBrowserOpen, setIsAppBrowserOpen] = useState(false)
  
  const nodes = useInfraStore(s => s.nodes)
  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const racks = useMemo(() => nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId), [nodes, currentSiteId])

  const placeCatalogHardware = useInfraStore((s) => s.placeCatalogHardware)
  const totalPowerKW = useInfraStore((s) => s.totalPowerKW)
  const totalRoomBTU = useInfraStore((s) => s.totalRoomBTU)
  const overloadedRackCount = useInfraStore((s) => s.overloadedRackCount)
  const selectedNodeId = useInfraStore((s) => s.selectedNodeId)
  const setPlacementMode = useInfraStore((s) => s.setPlacementMode)
  const placementMode = useInfraStore((s) => s.placementMode)
  const processAutoBackups = useInfraStore((s) => s.processAutoBackups)
  const setNetworkManagerOpen = useInfraStore(s => s.setNetworkManagerOpen)
  const pendingType = useInfraStore(s => s.pendingRackType)

  useEffect(() => {

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && (e.target as HTMLElement).tagName !== 'INPUT') {
        setIsTerminalOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    const interval = setInterval(() => {
      useInfraStore.getState().processTick()
    }, 10000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      processAutoBackups()
    }, 15000)
    return () => clearInterval(interval)
  }, [processAutoBackups])

  // Sync store placement mode with local placement state for modal compatibility
  
  useEffect(() => {
    if (placementMode && pendingType && pendingType !== 'RACK_42U') {
      setHardwareToAdd(pendingType as HardwareCatalogKey)
    } else if (!placementMode) {
      setHardwareToAdd(null)
    }
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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#020617] font-sans text-slate-200">
      {/* 3D Scene Background */}
      <div className="fixed inset-0 z-0 cursor-crosshair">
        <Scene />
      </div>

      {/* Top Navigation Bar */}
      <TopNav 
        onOpenNetwork={() => setNetworkManagerOpen(true)}
        onToggleNOC={() => setIsNOCDashboardOpen(!isNOCDashboardOpen)}
        onToggleTerminal={() => setIsTerminalOpen(!isTerminalOpen)}
        onOpenHandbook={() => setIsHandbookOpen(true)}
        isTerminalOpen={isTerminalOpen}
      />

      {/* Enterprise Catalog Toggle (Rocket) */}
      <div className="fixed bottom-8 right-32 z-[200]">
        <button 
          onClick={() => setIsAppBrowserOpen(!isAppBrowserOpen)}
          className={`relative w-20 h-20 rounded-[2.5rem] flex items-center justify-center transition-all shadow-2xl ${isAppBrowserOpen ? 'bg-slate-800 rotate-90' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          {isAppBrowserOpen ? (
            <X className="text-white w-8 h-8" />
          ) : (
            <Rocket className="text-white w-8 h-8" />
          )}
          {!isAppBrowserOpen && (
             <span className="absolute -top-10 right-0 bg-slate-900 text-white text-[10px] px-3 py-1 rounded-full border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity font-black uppercase tracking-widest">
               App Catalog
             </span>
          )}
        </button>
      </div>

      {/* Secondary Header Overlay: Site Toggle & Statistics */}
      <div className="fixed top-16 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-start justify-between">
          

          {/* Room Statistics */}
          <div className={`pointer-events-auto bg-[#0a1536]/80 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-2xl transition-all w-[320px] ${selectedNodeId ? 'translate-x-[-340px]' : ''}`}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-400">
                Facility Metrics
              </p>
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_5px_teal]" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Load</span>
                <span className="text-sm font-black text-white">{totalPowerKW.toFixed(1)} kW</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thermal</span>
                <span className="text-sm font-black text-white">{totalRoomBTU.toLocaleString()} <span className="text-[8px] text-slate-500">BTU/H</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alerts</span>
                <span className={`text-sm font-black ${overloadedRackCount > 0 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                  {overloadedRackCount > 0 ? `${overloadedRackCount} OVERLOAD` : 'NOMINAL'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Procurement System (Floating & Modal) */}
      {/* Procurement System (Floating) */}
      <ProcurementMenu 
        onAddRack={handleAddRack}
        isOpen={isProcurementOpen}
        onToggle={setIsProcurementOpen}
      />

      {/* Overlays & Managers */}
      <EmergencyToasts />
      {isNOCDashboardOpen && <Dashboard onClose={() => setIsNOCDashboardOpen(false)} />}
      <GlobalNetwork />
      <MissionHUD />
      <MissionLogic />

      <Inspector />
      <ApplicationBrowser isOpen={isAppBrowserOpen} onClose={() => setIsAppBrowserOpen(false)} />
      
      {isTerminalOpen && <Terminal onClose={() => setIsTerminalOpen(false)} />}
      {isHandbookOpen && <OperatorHandbook onClose={() => setIsHandbookOpen(false)} />}

      {/* Placement Tooltip */}
      {placementMode && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-teal-500 text-[#020617] px-8 py-4 rounded-2xl border-2 border-white/20 shadow-[0_20px_50px_rgba(20,184,166,0.3)] backdrop-blur-md font-black text-xs uppercase tracking-widest animate-bounce">
          Select target location on grid to deploy rack
        </div>
      )}

      {/* Thermal Alert Overlay */}
      {totalRoomBTU > 50000 && (
        <div className="fixed bottom-24 left-8 z-40 bg-red-600/20 border border-red-500/50 text-red-500 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.3)] backdrop-blur-md font-black text-xs uppercase tracking-[0.2em] animate-pulse flex items-center gap-4">
          <span className="text-2xl">⚠️</span>
          <div>
            <p>Thermal Critical</p>
            <p className="text-[9px] text-red-400/70 mt-1">Cooling capacity exceeded</p>
          </div>
        </div>
      )}

      {/* Hardware Target Rack Selection Modal */}
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
