import { Inspector } from './components/ui/Inspector'
import { Dashboard } from './components/ui/Dashboard'
import { NetworkManager } from './components/ui/NetworkManager'
import { Scene } from './components/world/Scene'
import { useInfraStore } from './store/useInfraStore'
import { useState, useMemo, useEffect } from 'react'
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
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-none transition-all">
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

function RansomwareVignette() {
  const nodes = useInfraStore(s => s.nodes)
  const hasInfection = nodes.some(n => n.isInfected)

  if (!hasInfection) return null

  return (
    <div 
      className="fixed inset-0 z-[90] pointer-events-none animate-pulse"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(168, 28, 88, 0.25) 80%, rgba(120, 0, 60, 0.5) 100%)',
        mixBlendMode: 'screen',
      }}
    />
  )
}

function App() {
  const [hardwareToAdd, setHardwareToAdd] = useState<HardwareCatalogKey | null>(null)
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
  const sites = useInfraStore(s => s.sites)
  const setCurrentSiteId = useInfraStore(s => s.setCurrentSiteId)
  const setNetworkManagerOpen = useInfraStore(s => s.setNetworkManagerOpen)

  useEffect(() => {
    const interval = setInterval(() => {
      processAutoBackups()
    }, 15000)
    return () => clearInterval(interval)
  }, [processAutoBackups])

  const handleAddRack = () => {
    setPlacementMode(true, '42U Rack')
  }

  const tryPlace = (key: HardwareCatalogKey) => {
    setHardwareToAdd(key)
  }

  const handleConfirmPlacement = (rackId: string) => {
    if (!hardwareToAdd) return
    placeCatalogHardware(hardwareToAdd, rackId)
    setHardwareToAdd(null)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900 font-sans text-slate-200">
      <header className="absolute top-4 left-[520px] z-20 pointer-events-none">
        <div className="pointer-events-auto bg-[#0a1536]/90 border border-slate-700/80 rounded-lg p-1 backdrop-blur-md flex items-center gap-1 shadow-xl">
          {sites.map(site => (
            <button
              key={site.id}
              onClick={() => setCurrentSiteId(site.id)}
              className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${currentSiteId === site.id ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              {site.isDisaster && <span className="text-base animate-pulse">🔥</span>}
              {site.name}
            </button>
          ))}
        </div>
      </header>

      <div className="fixed inset-0 z-0 cursor-crosshair">
        <Scene />
      </div>

      <aside className="pointer-events-auto fixed left-0 top-0 z-30 flex h-full w-72 flex-col gap-5 border-r border-[#48afbb]/35 bg-[#070f52] p-5 text-white shadow-[4px_0_24px_rgba(7,15,82,0.35)]">
        <div className="border-b border-white/10 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#48afbb]">
            Data center
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-[#fcfdfd]">
            Infra-Tycoon <span className="text-teal-400">3D</span>
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[#a8bfd0]">
            Global Infrastructure Simulator
          </p>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
            Data Center Management
          </p>
          <div className="flex flex-col gap-2 mb-6">
            <button
              onClick={() => setNetworkManagerOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-md border border-purple-500/50 bg-purple-900/30 text-purple-100 hover:bg-purple-800/40 hover:border-purple-400 transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-[#a855f7]">🌐</span> Global Network
              </span>
              <span className="text-purple-400 text-xs">Configure</span>
            </button>
          </div>

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
            Rack
          </p>
          <button
            type="button"
            onClick={handleAddRack}
            disabled={placementMode}
            className={`w-full rounded-md border px-3 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52] ${placementMode ? 'bg-slate-700 border-slate-600 text-slate-400' : 'border-[#48afbb]/50 bg-[#199277] text-white hover:bg-[#1faa8c] hover:border-[#5ec9b8]'}`}
          >
            {placementMode ? 'Placing Rack...' : 'Add 42U Rack'}
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#48afbb]">
            Hardware catalog
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => tryPlace('COMPUTE_1U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add Compute (1U)
            </button>
            <button
              type="button"
              onClick={() => tryPlace('NETAPP_STORAGE_2U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add NetApp Shelf (2U)
            </button>
            <button
              type="button"
              onClick={() => tryPlace('RUBRIK_BACKUP_2U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add Rubrik Node (2U)
            </button>
            <button
              type="button"
              onClick={() => tryPlace('CRAC_UNIT_4U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52]"
            >
              Add CRAC Unit (4U)
            </button>
            <button
              type="button"
              onClick={() => tryPlace('LOAD_BALANCER_1U')}
              className="rounded-md border border-white/15 bg-[#0d1854] px-3 py-2 text-left text-sm font-medium text-[#fcfdfd] transition hover:bg-[#121f6b] focus:outline-none focus:ring-2 focus:ring-[#48afbb] focus:ring-offset-2 focus:ring-offset-[#070f52] shadow-[0_0_10px_rgba(221,107,32,0.3)] border-[#dd6b20]/40"
            >
              Add Load Balancer (1U)
            </button>
          </div>
        </div>
      </aside>

      <EmergencyToasts />
      <RansomwareVignette />
      <Dashboard />
      <NetworkManager />
      <Inspector />

      <div
        className={`pointer-events-none fixed top-4 z-20 w-[260px] rounded-lg border border-[#48afbb]/25 bg-white/70 p-4 text-[#070f52] shadow-lg backdrop-blur-sm transition-all ${
          selectedNodeId ? 'right-[21.5rem]' : 'right-4'
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0b3a4a]">
          Room statistics
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[#0b3a4a]">Total power</span>
            <span className="font-semibold">{totalPowerKW.toFixed(1)} kW</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[#0b3a4a]">Total heat</span>
            <span className="font-semibold">
              {totalRoomBTU.toLocaleString()} BTU/hr
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[#0b3a4a]">Overloaded racks</span>
            <span
              className={
                overloadedRackCount > 0
                  ? 'font-semibold text-red-700'
                  : 'font-semibold'
              }
            >
              {overloadedRackCount}
            </span>
          </div>
        </div>
      </div>
      
      {placementMode && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-teal-900/90 text-teal-100 px-6 py-3 rounded-full border border-teal-500 shadow-2xl backdrop-blur-md font-medium text-sm animate-bounce">
          Hover over the grid to position your rack, then click to place.
        </div>
      )}

      {totalRoomBTU > 50000 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-red-900/90 text-red-100 px-6 py-3 rounded-full border border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] backdrop-blur-md font-bold text-sm animate-pulse flex items-center gap-2">
          <span className="text-xl">⚠️</span> HIGH TEMPERATURE WARNING: Add Cooling!
        </div>
      )}

      {hardwareToAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070f52]/80 backdrop-blur-sm">
          <div className="bg-[#0a1536] border border-[#48afbb]/50 p-6 rounded-lg shadow-2xl max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Select Target Rack</h2>
            {racks.length === 0 ? (
              <p className="text-slate-400 text-sm mb-4">You need to place a rack first.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4 pr-2">
                {racks.map(rack => (
                  <button 
                    key={rack.id}
                    onClick={() => handleConfirmPlacement(rack.id)}
                    className="p-3 text-left bg-slate-800/80 hover:bg-teal-900/60 border border-slate-700 hover:border-teal-500 rounded text-white transition-colors flex justify-between items-center"
                  >
                    <span className="font-semibold">{rack.name}</span>
                    <span className="text-xs text-slate-400">ID: {rack.id.slice(0,6)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button 
                onClick={() => setHardwareToAdd(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
