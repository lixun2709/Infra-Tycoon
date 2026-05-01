import React, { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Dashboard() {
  const [isOpen, setIsOpen] = useState(false)
  const { nodes, alerts, totalPowerKW, totalRoomBTU, simulateRandomFailure, simulateDataCorruption, triggerSiteDisaster, sites, currentSiteId, initiateFailover } = useInfraStore()

  const currentSite = sites.find(s => s.id === currentSiteId)

  const allHardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
  const siteHardware = allHardware.filter(n => n.siteId === currentSiteId)

  const globalHealthyCount = allHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const globalHealthIndex = allHardware.length > 0 ? Math.round((globalHealthyCount / allHardware.length) * 100) : 100

  const siteHealthyCount = siteHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const siteHealthIndex = siteHardware.length > 0 ? Math.round((siteHealthyCount / siteHardware.length) * 100) : 100

  const criticalCount = allHardware.filter(n => n.healthStatus === 'critical').length

  // Max capacity examples for the sparklines
  const MAX_POWER = 50 // kW
  const MAX_BTU = 100000 // BTU/hr

  const powerPercent = Math.min(100, (totalPowerKW / MAX_POWER) * 100)
  const thermalPercent = Math.min(100, (totalRoomBTU / MAX_BTU) * 100)

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-[300px] z-40 bg-[#070f52]/90 border border-[#48afbb]/50 text-white px-4 py-2 rounded-md shadow-lg hover:bg-[#0a1536] transition-colors font-semibold text-sm flex items-center gap-2 backdrop-blur-md"
      >
        <span>📊</span> NOC Dashboard
        {criticalCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{criticalCount}</span>}
      </button>
    )
  }

  return (
    <div className="fixed top-4 left-[300px] z-40 w-96 bg-[#060b18]/95 text-white shadow-2xl backdrop-blur-md border border-slate-700 rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#070f52]">
        <h2 className="font-bold tracking-wide flex items-center gap-2">
          <span>📡</span> NOC Operations Center
        </h2>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
          ✕
        </button>
      </div>

      <div className="p-4 flex-shrink-0 border-b border-slate-800 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700/50">
            <h3 className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-1">Global Health Index</h3>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-black ${globalHealthIndex > 80 ? 'text-green-400' : globalHealthIndex > 50 ? 'text-amber-400' : 'text-red-500'}`}>{globalHealthIndex}%</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{globalHealthyCount} / {allHardware.length} Nodes Healthy</p>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700/50">
            <h3 className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-1">{currentSite?.name} Health</h3>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-black ${siteHealthIndex > 80 ? 'text-green-400' : siteHealthIndex > 50 ? 'text-amber-400' : 'text-red-500'}`}>{siteHealthIndex}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-[10px] mb-1 text-slate-400 uppercase">
              <span>Facility Power</span>
              <span>{totalPowerKW.toFixed(1)}kW</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full transition-all ${powerPercent > 80 ? 'bg-red-500' : 'bg-[#48afbb]'}`} style={{ width: `${powerPercent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1 text-slate-400 uppercase">
              <span>Thermal Load</span>
              <span>{Math.max(0, totalRoomBTU).toLocaleString()} BTU</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full transition-all ${totalRoomBTU > 50000 ? 'bg-red-500' : totalRoomBTU < 0 ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${Math.max(0, thermalPercent)}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button 
            onClick={simulateRandomFailure}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[11px] font-semibold text-white transition-colors flex justify-center items-center gap-2"
          >
            <span>⚡</span> Simulate Random Hardware Failure
          </button>
          <button 
            onClick={simulateDataCorruption}
            className="w-full py-1.5 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 rounded text-[11px] font-semibold text-purple-200 transition-colors flex justify-center items-center gap-2"
          >
            <span>🦠</span> Simulate Ransomware Attack
          </button>
          <button 
            onClick={triggerSiteDisaster}
            className="w-full py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/40 rounded text-[11px] font-semibold text-red-200 transition-colors flex justify-center items-center gap-2"
          >
            <span>🔥</span> Trigger Site Disaster
          </button>
          
          {currentSite?.isDisaster && (
            <button 
              onClick={initiateFailover}
              className="w-full py-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 rounded text-[11px] font-black text-blue-300 transition-all flex justify-center items-center gap-2 mt-4 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse hover:shadow-[0_0_25px_rgba(59,130,246,0.5)]"
            >
              <span>🌐</span> INITIATE GLOBAL FAILOVER
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-900/50 p-4">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold">Recent Activity</h3>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-4">No recent alerts.</p>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className="flex gap-3 items-start">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-sm ${alert.severity === 'critical' ? 'bg-red-500 animate-pulse shadow-red-500/50' : alert.severity === 'warning' ? 'bg-amber-400 shadow-amber-400/50' : 'bg-blue-400 shadow-blue-400/50'}`} />
                <div>
                  <p className={`text-xs leading-snug ${alert.severity === 'critical' ? 'text-red-200' : alert.severity === 'warning' ? 'text-amber-200' : 'text-slate-300'}`}>
                    {alert.message}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
