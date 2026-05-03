import React, { useState, useEffect, useMemo } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Dashboard({ onClose }: { onClose: () => void }) {
  const {
    nodes, connections, alerts, acknowledgeAlert, acknowledgeAllAlerts,
    setSelectedNode, totalPowerKW, totalRoomBTU, simulateRandomFailure,
    simulateDataCorruption, triggerSiteDisaster, sites, currentSiteId,
    initiateFailover, networkLoad, setNetworkLoad, cloudLinks, cloudEgressGB,
    processCloudTiering, performMassRollback, processAIPredictions,
    simulateStressTest, toggleChaosMode, isChaosMode, resilienceIndex,
    refreshCount, repairCount, refreshHardware, repairHardware, generateFinalReport,
    carbonFootprintKg, tenants, totalEWasteKG, simulationCycle, auditLogs, postMortems
  } = useInfraStore()
  
  const [activeAlertTab, setActiveAlertTab] = useState<'active' | 'history' | 'ai' | 'esg' | 'chargeback' | 'audit' | 'lifecycle'>('active')
  const [showFinalReport, setShowFinalReport] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  const handleCompleteSimulation = () => {
    const report = generateFinalReport()
    setReportData(report)
    setShowFinalReport(true)
  }

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

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-[1400px] bg-[#060b18]/98 text-white shadow-2xl backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col" style={{ height: 'min(94vh, 1000px)' }} onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-[#070f52] flex-shrink-0">
            <h2 className="font-black text-sm tracking-[0.2em] flex items-center gap-3 uppercase">
              <span>📡</span> NOC Operations Center
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg">✕</button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* LEFT SIDEBAR: Navigation Tabs & Tab Content */}
            <div className="w-80 flex-shrink-0 border-r border-slate-700/30 flex flex-col bg-slate-950/40">
              <div className="flex border-b border-slate-700/30 bg-[#070f52]/60">
                {[
                  { id: 'active', label: 'ALERTS' },
                  { id: 'history', label: 'HISTORY' },
                  { id: 'ai', label: '🧠 AI' },
                  { id: 'esg', label: '🌿 ESG' },
                  { id: 'lifecycle', label: '♻️ LIFE' },
                  { id: 'audit', label: '⚖️ AUDIT' },
                  { id: 'chargeback', label: '💸 FINOPS' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAlertTab(tab.id as any)}
                    className={`flex-1 py-3 text-[9px] font-black tracking-widest transition-all ${activeAlertTab === tab.id ? 'text-white border-b-2 border-teal-500 bg-slate-800/40' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeAlertTab === 'active' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-1 px-1">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Alerts</p>
                      {alerts.filter(a => !a.isAcknowledged).length > 0 && (
                        <button 
                          onClick={acknowledgeAllAlerts}
                          className="text-[9px] font-black text-teal-500 hover:text-teal-400 uppercase tracking-tighter"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {alerts.filter(a => !a.isAcknowledged).map(alert => (
                        <div key={alert.id} className={`p-2.5 rounded-lg border flex flex-col gap-2 ${alert.severity === 'critical' ? 'bg-red-950/20 border-red-900/40' : 'bg-slate-800/30 border-slate-700/50'}`}>
                          <div className="flex gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alert.severity === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-200 leading-tight font-medium">{alert.message}</p>
                              <p className="text-[8px] text-slate-500 mt-1 font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="w-full py-1 bg-slate-800 hover:bg-slate-700 rounded text-[8px] font-black uppercase text-slate-400 tracking-widest transition-colors"
                          >
                            Acknowledge
                          </button>
                        </div>
                      ))}
                      {alerts.filter(a => !a.isAcknowledged).length === 0 && (
                        <div className="text-center py-8 opacity-30 italic text-[10px]">No active alerts.</div>
                      )}
                    </div>
                  </div>
                )}

                {activeAlertTab === 'history' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Event History</p>
                    <div className="space-y-2">
                      {alerts.filter(a => a.isAcknowledged).sort((a,b) => b.timestamp - a.timestamp).map(alert => (
                        <div key={alert.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/30 opacity-70">
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-slate-600" />
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 leading-tight">{alert.message}</p>
                              <p className="text-[8px] text-slate-600 mt-1 font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {alerts.filter(a => a.isAcknowledged).length === 0 && (
                        <div className="text-center py-8 opacity-30 italic text-[10px]">No historical data.</div>
                      )}
                    </div>
                  </div>
                )}

                {activeAlertTab === 'esg' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] mb-2">Sustainability & Compliance</p>
                      <div className="bg-emerald-950/10 border border-emerald-900/20 p-6 rounded-lg">
                        <p className="text-4xl font-black text-emerald-400">{carbonFootprintKg.toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mt-1">KG CO₂ / HOUR</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Regional Impact</p>
                      {sites.map(site => (
                        <div key={site.id} className="bg-slate-900/40 border border-slate-800 p-3 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-white">{site.name}</p>
                            <p className="text-[9px] text-slate-500 mt-0.5">{site.region}</p>
                          </div>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${site.energySource === 'Renewable' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {site.energySource}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeAlertTab === 'lifecycle' && (
                  <div className="space-y-6">
                    <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-xl font-black text-white">{totalEWasteKG.toFixed(0)}</p>
                        <p className="text-[8px] text-slate-500 uppercase font-bold">KG E-Waste</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-black text-teal-400">
                          {((refreshCount / (refreshCount + repairCount + 0.1)) * 100).toFixed(0)}%
                        </p>
                        <p className="text-[8px] text-slate-500 uppercase font-bold">Circular Score</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {allHardware.sort((a, b) => (simulationCycle - (a.installDate ?? 0)) - (simulationCycle - (b.installDate ?? 0))).map(node => {
                        const age = simulationCycle - (node.installDate ?? 0)
                        const isEOL = age > 800 || (node.degradation ?? 0) > 70
                        return (
                          <div key={node.id} className={`p-2.5 rounded-lg border ${isEOL ? 'bg-orange-950/20 border-orange-500/40' : 'bg-slate-900/40 border-slate-800'}`}>
                            <div className="flex justify-between items-center mb-1 text-[10px] font-bold">
                              <span className="text-white truncate max-w-[120px]">{node.name}</span>
                              <span className={isEOL ? 'text-orange-500' : 'text-slate-500'}>{isEOL ? 'EOL' : 'ACTIVE'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-500">
                              <span>Age: {age}</span>
                              <span>{(node.degradation ?? 0).toFixed(0)}% Wear</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button onClick={() => repairHardware(node.id)} className="py-1 bg-slate-800 rounded text-[8px] font-black uppercase">Repair</button>
                              <button onClick={() => refreshHardware(node.id)} className="py-1 bg-teal-900/40 border border-teal-500/30 rounded text-[8px] font-black uppercase">Refresh</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {activeAlertTab === 'audit' && (
                  <div className="space-y-3">
                    {auditLogs.map(log => (
                      <div key={log.id} className="bg-slate-900/60 border border-yellow-900/20 p-3 rounded-lg">
                        <div className="flex justify-between text-[8px] mb-1">
                          <span className="text-yellow-500 font-black uppercase">{log.type}</span>
                          <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-200 leading-tight">{log.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeAlertTab === 'ai' && (
                  <div className="space-y-4 text-center">
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em] mb-4">AIOps Post-Mortems</p>
                    {postMortems.map(pm => (
                      <div key={pm.id} className="bg-slate-900/40 border border-slate-800 p-2.5 rounded-lg text-left">
                        <p className="text-[10px] font-black text-orange-500 mb-1">INCIDENT #{pm.incidentNumber}</p>
                        <p className="text-[9px] text-slate-300 italic mb-1">"{pm.rca}"</p>
                        <p className="text-[8px] text-slate-500">Node: {pm.nodeName}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeAlertTab === 'chargeback' && (
                  <div className="space-y-3">
                    {chargebackReport.map(r => (
                      <div key={r.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-white">{r.name}</span>
                          <span className="text-xs font-black text-emerald-400">${r.total}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: '40%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* MAIN PANEL */}
            <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar space-y-4">

              {/* TOP METRICS */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-xl">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Global Health</p>
                  <p className={`text-3xl font-black ${globalHealthIndex > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{globalHealthIndex}%</p>
                  <p className="text-[9px] text-slate-600 mt-1 font-bold">{globalHealthyCount}/{allHardware.length} Healthy</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-xl">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">DC Health</p>
                  <p className={`text-3xl font-black ${siteHealthIndex > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{siteHealthIndex}%</p>
                  <div className="w-full bg-slate-950 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${siteHealthIndex}%` }} />
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-orange-500/20 p-4 rounded-xl">
                  <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">Resilience</p>
                  <p className="text-3xl font-black text-orange-500">{resilienceIndex}</p>
                  <div className="w-full bg-slate-950 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: `${resilienceIndex}%` }} />
                  </div>
                </div>
              </div>

              {/* SECONDARY STATS */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                    <span>Facility Power</span>
                    <span className="text-slate-300">{totalPowerKW.toFixed(1)}KW</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, (totalPowerKW / 50) * 100)}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                    <span>Thermal Load</span>
                    <span className="text-slate-300">{totalRoomBTU.toFixed(0)} BTU</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, (totalRoomBTU / 100000) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* FINOPS */}
              <div className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-xl">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">FinOps — Monthly Spend</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-black text-emerald-400">${Math.round(totalMonthlyCost)}</span>
                  <span className="text-slate-500 text-[10px] font-bold">/mo</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">On-Prem</p>
                    <p className="text-sm font-black text-white">${Math.round(localCostMonthly)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Cloud</p>
                    <p className="text-sm font-black text-blue-400">${Math.round(cloudCostMonthly)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Egress</p>
                    <p className="text-sm font-black text-orange-400">${Math.round(egressCostMonthly)}</p>
                  </div>
                </div>
              </div>

              {/* SECURITY */}
              <div className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-xl">
                <div className="grid grid-cols-3 text-center">
                  <div>
                    <p className="text-2xl font-black text-purple-500">{infectedCount}</p>
                    <p className="text-[8px] font-black text-slate-600 uppercase mt-1">Infected</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-blue-500">{protectedCount}</p>
                    <p className="text-[8px] font-black text-slate-600 uppercase mt-1">Protected</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-400">{exposedCount}</p>
                    <p className="text-[8px] font-black text-slate-600 uppercase mt-1">Exposed</p>
                  </div>
                </div>
              </div>

              {/* ACTIONS & CONTROLS */}
              <div className="grid grid-cols-4 gap-2">
                <button onClick={simulateRandomFailure} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-[8px] font-black uppercase tracking-widest hover:border-teal-500/50 transition-colors">⚡ Failure</button>
                <button onClick={simulateDataCorruption} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-[8px] font-black uppercase tracking-widest hover:border-red-500/50 transition-colors">🦠 Ransom</button>
                <button onClick={triggerSiteDisaster} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-[8px] font-black uppercase tracking-widest hover:border-orange-500/50 transition-colors">🔥 Disaster</button>
                <button onClick={simulateStressTest} className="py-2 bg-slate-900 border border-slate-700 rounded-lg text-[8px] font-black uppercase tracking-widest hover:border-blue-500/50 transition-colors">🧬 Stress</button>
                
                <button 
                  onClick={handleCompleteSimulation}
                  className="col-span-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg font-black text-[8px] uppercase tracking-[0.2em] shadow-lg border border-teal-400/30 transition-all"
                >
                  🏆 Complete 30-Day Simulation
                </button>
              </div>

              {/* NETWORK LOAD */}
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/50">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Network Load Control</p>
                  <p className="text-[9px] font-black text-teal-400 font-mono">{(networkLoad * 100).toFixed(0)}%</p>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05" value={networkLoad}
                  onChange={(e) => setNetworkLoad(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* FINAL REPORT MODAL */}
      {showFinalReport && reportData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
          <div className="bg-slate-900 border-2 border-teal-500/50 w-full max-w-2xl rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(45,212,191,0.2)]">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-8 text-center relative">
              <p className="text-[10px] font-black text-teal-100 uppercase tracking-[0.4em] mb-2">Simulation Complete</p>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{reportData.grade}</h2>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-4 gap-6">
                {[
                  { label: 'Performance', val: reportData.score, color: 'text-teal-400' },
                  { label: 'Resilience', val: reportData.breakdown.resilienceIndex, color: 'text-blue-400' },
                  { label: 'Compliance', val: 100 - (reportData.breakdown.violations * 5), color: 'text-emerald-400' },
                  { label: 'Sustainability', val: 100 - Math.min(100, reportData.breakdown.carbonFootprintKg), color: 'text-green-400' }
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <p className={`text-3xl font-black ${stat.color}`}>{stat.val}%</p>
                    <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950/60 rounded-xl p-6 border border-slate-800">
                <p className="text-sm text-slate-400 italic leading-relaxed">
                  "Having demonstrated exceptional proficiency in autonomous infrastructure management, compliance sovereignty, and sustainable lifecycle operations..."
                </p>
                <div className="mt-6 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-teal-500 uppercase">Status</p>
                    <p className="text-lg font-black text-white uppercase tracking-widest">
                      {reportData.score > 80 ? '🎖️ ARCHITECT VERIFIED' : '🎓 APPRENTICE GRADUATE'}
                    </p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-400">
                    {new Date().toISOString().split('T')[0]}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowFinalReport(false)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-black text-xs uppercase tracking-[0.2em] transition-all"
              >
                Return to Command Center
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
