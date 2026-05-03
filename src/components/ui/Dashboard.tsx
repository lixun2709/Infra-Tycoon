import { useState, useEffect, useMemo } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  AlertCircle, 
  History, 
  Brain, 
  Leaf, 
  RefreshCcw, 
  Scale, 
  DollarSign,
  LayoutDashboard,
  X,
  Zap
} from 'lucide-react'

export function Dashboard({ onClose }: { onClose: () => void }) {
  const {
    nodes, alerts, acknowledgeAlert, acknowledgeAllAlerts,
    totalPowerKW, totalRoomBTU, simulateRandomFailure,
    simulateDataCorruption, triggerSiteDisaster, sites, currentSiteId,
    networkLoad, setNetworkLoad, cloudLinks, cloudEgressGB,
    resilienceIndex, refreshCount, repairCount, refreshHardware, repairHardware,
    simulateStressTest,
    carbonFootprintKg, tenants, totalEWasteKG, simulationCycle, auditLogs, postMortems,
    isHeatMapVisible, toggleHeatMap
  } = useInfraStore()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'ai' | 'esg' | 'lifecycle' | 'audit' | 'chargeback'>('overview')
  const [showFinalReport, setShowFinalReport] = useState(false)
  const [reportData] = useState<any>(null)


  const allHardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
  const siteHardware = allHardware.filter(n => n.siteId === currentSiteId)

  const globalHealthyCount = allHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const globalHealthIndex = allHardware.length > 0 ? Math.round((globalHealthyCount / allHardware.length) * 100) : 100

  const siteHealthyCount = siteHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const siteHealthIndex = siteHardware.length > 0 ? Math.round((siteHealthyCount / siteHardware.length) * 100) : 100

  // Security Stats
  const infectedCount = allHardware.filter(n => n.isInfected).length
  const protectedCount = allHardware.filter(n => n.backupStatus === 'protected').length
  const exposedCount = allHardware.filter(n => n.backupStatus === 'unprotected' && !n.isInfected).length

  // FinOps summary
  const localStorageTB = nodes.reduce((sum, n) => sum + (n.usedStorageTB ?? 0), 0)
  const cloudStorageTB = cloudLinks.reduce((sum, cl) => sum + cl.tieredTB, 0)
  const localCostMonthly = localStorageTB * 1000 * 0.02
  const cloudCostMonthly = cloudStorageTB * 1000 * 0.05
  const egressCostMonthly = cloudEgressGB * 0.09
  const totalMonthlyCost = localCostMonthly + cloudCostMonthly + egressCostMonthly

  // Chargeback Report Data
  const chargebackReport = useMemo(() => {
    return tenants.map(tenant => {
      const tenantNodes = nodes.filter(n => n.tenantId === tenant.id)
      let computeCost = 0
      let storageCost = 0
      let networkCost = 0
      let backupCost = 0
      tenantNodes.forEach(n => {
        if (n.type === 'compute') computeCost += 200
        if (n.type === 'storage') storageCost += 50 + (n.totalStorageTB ?? 0) * 5
        if (n.type === 'network') networkCost += 100
        if (n.type === 'backup') backupCost += 150
      })
      const total = computeCost + storageCost + networkCost + backupCost
      return { ...tenant, compute: computeCost, storage: storageCost, network: networkCost, backup: backupCost, total }
    })
  }, [tenants, nodes])


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
      store.processCloudTiering()
      store.processAIPredictions()
      store.processTenancyEffect()
      store.processAging()
    }, 1000)
    return () => clearInterval(interval)
  }, [networkLoad])

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard },
    { id: 'events', label: 'EVENTS', icon: AlertCircle },
    { id: 'ai', label: 'AI OPS', icon: Brain },
    { id: 'esg', label: 'ESG', icon: Leaf },
    { id: 'lifecycle', label: 'LIFE', icon: RefreshCcw },
    { id: 'audit', label: 'AUDIT', icon: Scale },
    { id: 'chargeback', label: 'FINOPS', icon: DollarSign },
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
                      DC Health <span>🏢</span>
                    </p>
                    <p className={`text-2xl font-black ${siteHealthIndex > 80 ? 'text-teal-400' : 'text-amber-400'}`}>{siteHealthIndex}%</p>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-teal-500 h-full shadow-[0_0_10px_teal]" style={{ width: `${siteHealthIndex}%` }} />
                    </div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl group hover:border-orange-500/30 transition-all">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] mb-4 flex justify-between">
                      Resilience <span>🛡️</span>
                    </p>
                    <p className="text-2xl font-black text-orange-500">{resilienceIndex}</p>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-orange-500 h-full shadow-[0_0_10px_orange]" style={{ width: `${resilienceIndex}%` }} />
                    </div>
                  </div>
                </div>

                {/* SECONDARY STATS */}
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-2"><DollarSign size={12}/> Facility Power</span>
                      <span className="text-slate-300 font-mono">{totalPowerKW.toFixed(1)}KW</span>
                    </div>
                    <div className="w-full bg-slate-900/50 h-2 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-blue-500 h-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${Math.min(100, (totalPowerKW / 50) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Leaf size={12}/> Thermal Load</span>
                      <span className="text-slate-300 font-mono">{totalRoomBTU.toFixed(0)} BTU/H</span>
                    </div>
                    <div className="w-full bg-slate-900/50 h-2 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-rose-500 h-full shadow-[0_0_15px_rgba(244,63,94,0.5)]" style={{ width: `${Math.min(100, (totalRoomBTU / 100000) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* FINOPS SECTION */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <DollarSign size={120} />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald]" />
                    FinOps Ecosystem — OpEx Forecast
                  </p>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl font-black text-emerald-400 tracking-tighter">${Math.round(totalMonthlyCost).toLocaleString()}</span>
                    <span className="text-slate-500 text-sm font-bold uppercase tracking-widest">Monthly spend</span>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Bare Metal</p>
                      <p className="text-xl font-black text-white">${Math.round(localCostMonthly).toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Hybrid Cloud</p>
                      <p className="text-xl font-black text-blue-400">${Math.round(cloudCostMonthly).toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Data Egress</p>
                      <p className="text-xl font-black text-orange-400">${Math.round(egressCostMonthly).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* SECURITY SECTION */}
                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] group hover:border-purple-500/30 transition-all">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_purple]" />
                    Cybersecurity & Resilience Matrix
                  </p>
                  <div className="grid grid-cols-3 gap-8 text-center">
                    <div>
                      <p className="text-3xl font-black text-purple-500 tracking-tighter">{infectedCount}</p>
                      <p className="text-[10px] font-black text-slate-600 uppercase mt-2 tracking-widest">Compromised</p>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-blue-500 tracking-tighter">{protectedCount}</p>
                      <p className="text-[10px] font-black text-slate-600 uppercase mt-2 tracking-widest">Encrypted</p>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-slate-400 tracking-tighter">{exposedCount}</p>
                      <p className="text-[10px] font-black text-slate-600 uppercase mt-2 tracking-widest">Exposed</p>
                    </div>
                  </div>
                </div>

                {/* ACTIONS & FOOTER */}
                <div className="flex items-center gap-4">
                   <div className="flex-1 grid grid-cols-4 gap-4">
                      <button onClick={simulateRandomFailure} className="py-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-teal-500/50 hover:bg-teal-500/10 transition-all">⚡ Inject Failure</button>
                      <button onClick={simulateDataCorruption} className="py-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-red-500/50 hover:bg-red-500/10 transition-all">🦠 Ransomware</button>
                      <button onClick={triggerSiteDisaster} className="py-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-orange-500/50 hover:bg-orange-500/10 transition-all">🔥 Site disaster</button>
                      <button onClick={simulateStressTest} className="py-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-blue-500/50 hover:bg-blue-500/10 transition-all">🧬 Stress test</button>
                   </div>
                   
                   <div className="w-[300px] bg-slate-950/40 p-5 rounded-[2rem] border border-slate-800/50">
                      <div className="flex justify-between items-center mb-3 px-1">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Network Load</p>
                        <p className="text-[10px] font-black text-teal-400 font-mono">{(networkLoad * 100).toFixed(0)}%</p>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.05" value={networkLoad}
                        onChange={(e) => setNetworkLoad(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                      />
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


            {activeTab === 'ai' && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="bg-orange-950/10 border border-orange-500/30 p-8 rounded-[2.5rem] text-center">
                  <Brain className="text-orange-500 mx-auto mb-6" size={48} />
                  <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4">AIOps Intelligence Engine</h3>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed">
                    Predictive analysis of hardware failure and automated post-mortem generation.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {postMortems.map(pm => (
                    <div key={pm.id} className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group hover:border-orange-500/50 transition-all">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                         <AlertCircle size={80} />
                      </div>
                      <div className="flex items-center gap-4 mb-4">
                        <span className="px-3 py-1 bg-orange-500 rounded-lg text-slate-900 text-[10px] font-black uppercase">INCIDENT #{pm.incidentNumber}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{pm.nodeName}</span>
                      </div>
                      <p className="text-lg font-bold text-white mb-4 leading-snug">"{pm.rca}"</p>
                      <div className="grid grid-cols-2 gap-8 text-[11px]">
                         <div>
                            <p className="text-slate-500 font-black uppercase mb-1 tracking-widest">Impact</p>
                            <p className="text-slate-300 font-medium">{pm.impact}</p>
                         </div>
                         <div>
                            <p className="text-slate-500 font-black uppercase mb-1 tracking-widest">Mitigation</p>
                            <p className="text-slate-300 font-medium">{pm.mitigation}</p>
                         </div>
                      </div>
                    </div>
                  ))}
                  {postMortems.length === 0 && (
                    <div className="text-center py-24 opacity-20 italic font-black text-xs uppercase tracking-widest">No systemic failures recorded by AI</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'esg' && (
              <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 mb-8 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                    <Leaf className="text-emerald-500" size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-[0.3em] mb-4">Net-Zero Compliance Dashboard</h3>
                  <p className="text-sm text-slate-400 font-medium max-w-lg leading-relaxed">
                    Monitoring regional energy consumption and carbon offset requirements for sustainable infrastructure.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2rem] text-center">
                     <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.3em] mb-4">Carbon Footprint</p>
                     <p className="text-4xl font-black text-emerald-400 tracking-tighter">{carbonFootprintKg.toFixed(2)}</p>
                     <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-4">KG CO₂ / HOUR (AGGREGATE)</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2rem] space-y-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Facility Impact Grid</p>
                    {sites.map(site => (
                      <div key={site.id} className="bg-slate-950/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center group hover:border-emerald-500/30 transition-all">
                        <div>
                          <p className="text-sm font-bold text-white">{site.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{site.region}</p>
                        </div>
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase shadow-inner ${site.energySource === 'Renewable' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {site.energySource}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lifecycle' && (
              <div className="space-y-12 animate-in slide-in-from-left-4 duration-500">
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-900/40 border border-slate-800 p-10 rounded-[2.5rem] flex items-center justify-between">
                    <div>
                      <p className="text-4xl font-black text-white tracking-tighter">{totalEWasteKG.toFixed(0)}</p>
                      <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest mt-2">Aggregate E-Waste Mass (KG)</p>
                    </div>
                    <RefreshCcw className="text-slate-800" size={80} />
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-10 rounded-[2.5rem] flex items-center justify-between">
                    <div>
                      <p className="text-4xl font-black text-teal-400 tracking-tighter">
                        {((refreshCount / (refreshCount + repairCount + 0.1)) * 100).toFixed(0)}%
                      </p>
                      <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest mt-2">Hardware Sustainability Score</p>
                    </div>
                    <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center border border-teal-500/30">
                       <Scale className="text-teal-500" size={32} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  {allHardware.sort((a, b) => (simulationCycle - (a.installDate ?? 0)) - (simulationCycle - (b.installDate ?? 0))).map(node => {
                    const age = simulationCycle - (node.installDate ?? 0)
                    const isEOL = age > 800 || (node.degradation ?? 0) > 70
                    return (
                      <div key={node.id} className={`p-6 rounded-3xl border-2 transition-all hover:scale-[1.02] ${isEOL ? 'bg-orange-950/10 border-orange-500/30' : 'bg-slate-900/20 border-slate-800'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs font-black text-white truncate max-w-[120px] tracking-tight">{node.name}</span>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${isEOL ? 'bg-orange-500 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>{isEOL ? 'EOL' : 'OK'}</span>
                        </div>
                        <div className="space-y-2 mb-6">
                           <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>Cycle Age</span> <span>{age}</span></div>
                           <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>Wear</span> <span>{(node.degradation ?? 0).toFixed(0)}%</span></div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <button onClick={() => repairHardware(node.id)} className="py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[9px] font-black uppercase transition-colors">Component Repair</button>
                          <button onClick={() => refreshHardware(node.id)} className="py-2.5 bg-teal-900/40 border border-teal-500/30 hover:bg-teal-500 hover:text-slate-900 rounded-xl text-[9px] font-black uppercase transition-all">Modernize Refresh</button>
                        </div>
                      </div>
                    )
                  })}
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

            {activeTab === 'chargeback' && (
              <div className="max-w-5xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
                 <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 flex flex-col items-center text-center">
                    <DollarSign className="text-emerald-500 mb-6" size={48} />
                    <h3 className="text-2xl font-black text-white uppercase tracking-[0.3em] mb-4">Tenant Chargeback Engine</h3>
                    <p className="text-sm text-slate-400 font-medium max-w-xl leading-relaxed">
                      Cross-charge reporting for shared infrastructure consumption and allocated resource reservations.
                    </p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-8">
                    {chargebackReport.map(r => (
                      <div key={r.id} className="p-8 bg-slate-900/20 border border-slate-800 rounded-[2rem] hover:border-emerald-500/30 transition-all">
                        <div className="flex justify-between items-start mb-8">
                          <div>
                            <div className="w-10 h-10 rounded-xl mb-4" style={{ backgroundColor: r.color }} />
                            <p className="text-2xl font-black text-white tracking-tighter">{r.name}</p>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Tenant Partition ID: {r.id.slice(0,8)}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-2xl font-black text-emerald-400 tracking-tighter">${r.total.toLocaleString()}</p>
                             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">MTD Invoice</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                           {[
                             { label: 'Compute Engine', val: r.compute, color: 'bg-blue-500' },
                             { label: 'Storage Cluster', val: r.storage, color: 'bg-teal-500' },
                             { label: 'Network Fabric', val: r.network, color: 'bg-purple-500' },
                             { label: 'Backup Services', val: r.backup, color: 'bg-orange-500' }
                           ].map((item, idx) => (
                             <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tight">
                                   <span>{item.label}</span>
                                   <span className="text-white">${item.val}</span>
                                </div>
                                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                                   <div className={`${item.color} h-full shadow-[0_0_10px_rgba(0,0,0,0.5)]`} style={{ width: `${Math.min(100, (item.val / (r.total + 1)) * 100)}%` }} />
                                </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FINAL REPORT MODAL */}
      {showFinalReport && reportData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl">
          <div className="bg-[#020617] border-4 border-teal-500/50 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(45,212,191,0.2)]">
            <div className="bg-gradient-to-br from-teal-600 to-emerald-700 p-12 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-10">
                  <Activity size={180} />
               </div>
              <p className="text-[11px] font-black text-teal-100 uppercase tracking-[0.6em] mb-4">Autonomous Certification Protocol</p>
              <h2 className="text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{reportData.grade}</h2>
            </div>
            
            <div className="p-12 space-y-10">
              <div className="grid grid-cols-4 gap-8">
                {[
                  { label: 'Uptime Score', val: reportData.score, color: 'text-teal-400' },
                  { label: 'Resilience', val: reportData.breakdown.resilienceIndex, color: 'text-blue-400' },
                  { label: 'Compliance', val: 100 - (reportData.breakdown.violations * 5), color: 'text-emerald-400' },
                  { label: 'Sustainability', val: 100 - Math.min(100, reportData.breakdown.carbonFootprintKg), color: 'text-green-400' }
                ].map((stat, i) => (
                  <div key={i} className="text-center group">
                    <p className={`text-4xl font-black mb-2 transition-transform group-hover:scale-110 ${stat.color}`}>{stat.val}%</p>
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/50 rounded-3xl p-8 border border-white/5 relative">
                <p className="text-lg text-slate-300 italic leading-relaxed font-medium">
                  "Demonstrated mastery of infrastructure sovereignty, multi-region routing protocols, and predictive lifecycle sustainability..."
                </p>
                <div className="mt-8 flex justify-between items-end border-t border-white/5 pt-8">
                  <div>
                    <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.3em] mb-2">Credentials Issued</p>
                    <p className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                      {reportData.score > 80 ? '🎖️ ELITE ARCHITECT' : '🎓 GRADUATE ADMIN'}
                      <ShieldCheck className="text-teal-500" size={24} />
                    </p>
                  </div>
                  <div className="text-right text-sm font-mono text-slate-500">
                    {new Date().toISOString().split('T')[0]}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowFinalReport(false)}
                className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.3em] transition-all border border-white/5 shadow-xl"
              >
                Return to Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ShieldCheck({ className, size }: { className?: string, size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
}
