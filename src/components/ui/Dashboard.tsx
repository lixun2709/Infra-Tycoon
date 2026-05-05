import { useState, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  AlertCircle, 
  History, 
  Scale, 
  LayoutDashboard,
  X,
  Zap
} from 'lucide-react'

export function Dashboard({ onClose }: { onClose: () => void }) {
  const {
    nodes, alerts, acknowledgeAlert, acknowledgeAllAlerts,
    totalPowerKW, currentSiteId,
    networkLoad,
    simulationCycle, auditLogs,
    isHeatMapVisible, toggleHeatMap
  } = useInfraStore()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'audit'>('overview')

  const allHardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
  const siteHardware = allHardware.filter(n => n.siteId === currentSiteId)

  const globalHealthyCount = allHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const globalHealthIndex = allHardware.length > 0 ? Math.round((globalHealthyCount / allHardware.length) * 100) : 100

  const siteHealthyCount = siteHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const siteHealthIndex = siteHardware.length > 0 ? Math.round((siteHealthyCount / siteHardware.length) * 100) : 100



  // Live Performance Simulator
  useEffect(() => {
    if (networkLoad === 0) return
    const interval = setInterval(() => {
      useInfraStore.setState(state => {
        const updatedConnections = state.connections.map(c => {
          if (c.status === 'blocked') return { ...c, throughputGbps: 0 }
          const targetThroughput = c.bandwidthGbps * networkLoad
          const variance = targetThroughput * 0.2
          const newThroughput = Math.max(0, Math.min(c.bandwidthGbps, targetThroughput + (Math.random() * variance * 2 - variance)))
          const newSync = Math.min(100, (c.syncProgress ?? 0) + (newThroughput / c.bandwidthGbps) * 5)
          return { ...c, throughputGbps: newThroughput, syncProgress: newSync }
        })
        return { connections: updatedConnections }
      })
      const store = useInfraStore.getState()
      store.processAging()
    }, 1000)
    return () => clearInterval(interval)
  }, [networkLoad])

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard },
    { id: 'events', label: 'EVENTS', icon: AlertCircle },
    { id: 'audit', label: 'AUDIT LOGS', icon: Scale },
  ]

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={onClose}>
        <div className="w-full max-w-[1400px] bg-[#020617]/95 text-white shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl border border-slate-700/50 rounded-[2rem] overflow-hidden flex flex-col" style={{ height: 'min(94vh, 1000px)' }} onClick={(e) => e.stopPropagation()}>

          {/* New Horizontal Header Design */}
          <div className="bg-[#070f52]/40 border-b border-slate-700/50 p-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="bg-teal-500 p-2.5 rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                <span className="text-xl">📡</span>
              </div>
              <h2 className="font-black text-xl tracking-tighter uppercase mr-12">
                NOC Operations Center
              </h2>
              
              {/* Horizontal Tabs List */}
              <nav className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                        isActive 
                        ? 'bg-teal-600 text-white shadow-lg' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleHeatMap}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all border ${
                  isHeatMapVisible 
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]' 
                  : 'bg-slate-800/50 text-slate-500 border-white/5 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                <Zap size={14} className={isHeatMapVisible ? 'animate-pulse' : ''} />
                THERMAL
              </button>

              <button onClick={onClose} className="p-2.5 bg-slate-800/50 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all text-slate-400 border border-white/5">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* TOP METRICS */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group hover:border-emerald-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex justify-between">
                      Global Health <span>📶</span>
                    </p>
                    <p className={`text-2xl font-black ${globalHealthIndex > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{globalHealthIndex}%</p>
                    <p className="text-xs text-slate-400 mt-2 font-bold tracking-tight">{globalHealthyCount}/{allHardware.length} Hardware Nodes Online</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group hover:border-teal-500/30 transition-all">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex justify-between">
                      SLA Compliance <span>🏆</span>
                    </p>
                    <p className={`text-2xl font-black ${siteHealthIndex > 99 ? 'text-teal-400' : 'text-amber-400'}`}>99.99%</p>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-teal-500 h-full shadow-[0_0_10px_teal]" style={{ width: `99%` }} />
                    </div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group hover:border-orange-500/30 transition-all">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4 flex justify-between">
                      Network Uptime <span>🛰️</span>
                    </p>
                    <p className="text-2xl font-black text-orange-500">100%</p>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-orange-500 h-full shadow-[0_0_10px_orange]" style={{ width: `100%` }} />
                    </div>
                  </div>
                </div>

                {/* CAPACITY & UTILIZATION */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] relative overflow-hidden mt-6">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-teal-500">
                    <Zap size={120} />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_10px_teal]" />
                    Facility Utilization — Capacity Forecast
                  </p>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-black text-teal-400 tracking-tighter">{(totalPowerKW / 100 * 100).toFixed(1)}%</span>
                    <span className="text-slate-500 text-sm font-bold uppercase tracking-widest">Aggregate Site Power Load (100kW Limit)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Occupancy</p>
                      <p className="text-xl font-black text-white">{nodes.filter(n => n.parentRackId).length} / {nodes.filter(n => n.type === 'rack').length * 42} U-Slots</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Efficiency (PUE)</p>
                      <p className="text-xl font-black text-blue-400">1.12 Nominal</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Fabric Links</p>
                      <p className="text-xl font-black text-orange-400">{useInfraStore.getState().connections.length} Active</p>
                    </div>
                  </div>
                </div>

                {/* OPERATIONAL INTEGRITY */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] flex items-center justify-between mt-6">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(16,185,129,0.1)]">🛡️</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Infrastructure Resilience</p>
                      <p className="text-lg font-black text-white uppercase tracking-tight">Logical Integrity Verified</p>
                    </div>
                  </div>
                  <div className="flex gap-12 text-right">
                    <div>
                      <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Alert Backlog</p>
                      <p className="text-xl font-black text-slate-300 font-mono">0</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Path Redundancy</p>
                      <p className="text-xl font-black text-teal-500 font-mono">100%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MERGED EVENTS TAB: Side-by-Side Alerts and History */}
            {activeTab === 'events' && (
              <div className="grid grid-cols-2 gap-12 h-full animate-in slide-in-from-bottom-4 duration-500">
                {/* Left Side: Active Alerts */}
                <div className="flex flex-col space-y-6">
                  <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800">
                    <h3 className="text-xs font-black text-white tracking-widest uppercase flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]" />
                      Critical Active Alerts
                    </h3>
                    {alerts.filter(a => !a.isAcknowledged).length > 0 && (
                      <button 
                        onClick={acknowledgeAllAlerts}
                        className="text-[9px] font-black text-teal-400 hover:text-teal-300 uppercase underline decoration-teal-900 underline-offset-4"
                      >
                        Purge All Alerts
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {alerts.filter(a => !a.isAcknowledged).map(alert => (
                      <div key={alert.id} className={`p-5 rounded-2xl border-2 flex flex-col gap-4 group transition-all hover:translate-x-2 ${alert.severity === 'critical' ? 'bg-red-950/10 border-red-900/30' : 'bg-slate-900/30 border-slate-800'}`}>
                        <div className="flex gap-4">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alert.severity === 'critical' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'}`} />
                          <div className="flex-1">
                            <p className="text-[11px] text-slate-100 leading-relaxed font-semibold tracking-tight">{alert.message}</p>
                            <p className="text-[9px] text-slate-500 mt-2 font-mono flex items-center gap-2">
                              <History size={10} /> {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="w-full py-2.5 bg-slate-900/50 hover:bg-slate-800 rounded-xl text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] transition-all border border-white/5"
                        >
                          Clear Incident
                        </button>
                      </div>
                    ))}
                    {alerts.filter(a => !a.isAcknowledged).length === 0 && (
                      <div className="text-center py-24 opacity-20 flex flex-col items-center gap-4">
                        <AlertCircle size={48} />
                        <p className="font-black text-xs uppercase tracking-widest italic">All systems nominal</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: History */}
                <div className="flex flex-col space-y-6">
                  <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800">
                    <h3 className="text-xs font-black text-slate-400 tracking-widest uppercase flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Historical Event Log
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {alerts.filter(a => a.isAcknowledged).sort((a,b) => b.timestamp - a.timestamp).map(alert => (
                      <div key={alert.id} className="p-4 rounded-2xl border border-slate-800/50 bg-slate-900/20 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex gap-4">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-slate-600" />
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 leading-relaxed">{alert.message}</p>
                            <p className="text-[8px] text-slate-600 mt-2 font-mono">{new Date(alert.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {alerts.filter(a => a.isAcknowledged).length === 0 && (
                      <div className="text-center py-24 opacity-20 flex flex-col items-center gap-4">
                        <History size={48} />
                        <p className="font-black text-xs uppercase tracking-widest italic">Log buffer empty</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 flex justify-between items-center">
                   <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Immutable Governance Logs</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Compliance Audit Trail v1.1</p>
                   </div>
                   <Scale className="text-slate-800" size={48} />
                </div>
                <div className="space-y-3 overflow-hidden rounded-[2.5rem]">
                  {auditLogs.map(log => (
                    <div key={log.id} className="bg-slate-900/20 border-b border-white/5 p-6 hover:bg-slate-900/40 transition-colors">
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase ${log.status === 'Blocked' ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>{log.type}</span>
                        <span className="text-[10px] text-slate-600 font-mono">{new Date(log.timestamp).toLocaleTimeString()} — Cycle {simulationCycle}</span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium leading-relaxed">{log.message}</p>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-center py-32 opacity-20 font-black text-xs uppercase tracking-[0.4em]">No governance events triggered</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
