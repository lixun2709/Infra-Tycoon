import React, { useState, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export function Dashboard() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeAlertTab, setActiveAlertTab] = useState<'active' | 'history'>('active')
  const { nodes, connections, alerts, acknowledgeAlert, acknowledgeAllAlerts, setSelectedNode, totalPowerKW, totalRoomBTU, simulateRandomFailure, simulateDataCorruption, triggerSiteDisaster, sites, currentSiteId, initiateFailover, networkLoad, setNetworkLoad, cloudLinks, cloudEgressGB, processCloudTiering, performMassRollback, processAIPredictions, simulateStressTest } = useInfraStore()

  const currentSite = sites.find(s => s.id === currentSiteId)

  const allHardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')
  const siteHardware = allHardware.filter(n => n.siteId === currentSiteId)

  const globalHealthyCount = allHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const globalHealthIndex = allHardware.length > 0 ? Math.round((globalHealthyCount / allHardware.length) * 100) : 100

  const siteHealthyCount = siteHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const siteHealthIndex = siteHardware.length > 0 ? Math.round((siteHealthyCount / siteHardware.length) * 100) : 100

  const criticalCount = allHardware.filter(n => n.healthStatus === 'critical').length
  const unacknowledgedCount = alerts.filter(a => !a.isAcknowledged).length

  const infectedCount = allHardware.filter(n => n.isInfected).length
  const protectedCount = allHardware.filter(n => n.isImmutable).length
  const unprotectedCount = allHardware.filter(n => !n.isImmutable && !n.isInfected).length
  const hasActiveThreats = infectedCount > 0

  // Max capacity examples for the sparklines
  const MAX_POWER = 50 // kW
  const MAX_BTU = 100000 // BTU/hr

  const powerPercent = Math.min(100, (totalPowerKW / MAX_POWER) * 100)
  const thermalPercent = Math.min(100, (totalRoomBTU / MAX_BTU) * 100)

  // FinOps cost calculation
  const localStorageTB = nodes.reduce((sum, n) => sum + (n.usedStorageTB ?? 0), 0)
  const cloudStorageTB = cloudLinks.reduce((sum, cl) => sum + cl.tieredTB, 0)
  const localCostMonthly = localStorageTB * 1000 * 0.02 // $0.02/GB
  const cloudCostMonthly = cloudStorageTB * 1000 * 0.05 // $0.05/GB for cloud
  const egressCostMonthly = cloudEgressGB * 0.09 // $0.09/GB egress
  const totalMonthlyCost = localCostMonthly + cloudCostMonthly + egressCostMonthly

  // Live Performance Simulator
  useEffect(() => {
    if (networkLoad === 0) return
    const interval = setInterval(() => {
      useInfraStore.setState(state => {
        // Randomize connection throughput based on network load
        const updatedConnections = state.connections.map(c => {
          const targetThroughput = c.bandwidthGbps * networkLoad
          const variance = targetThroughput * 0.2
          const newThroughput = Math.max(0, Math.min(c.bandwidthGbps, targetThroughput + (Math.random() * variance * 2 - variance)))
          return { ...c, throughputGbps: newThroughput }
        })

        // Increase storage slightly over time based on load
        const updatedNodes = state.nodes.map(n => {
          if ((n.type === 'storage' || n.type === 'backup' || n.type === 'compute') && (n.totalStorageTB ?? 0) > 0 && n.healthStatus !== 'critical') {
            const addedStorage = (networkLoad * 0.5) * Math.random()
            const newUsed = Math.min(n.totalStorageTB!, (n.usedStorageTB ?? 0) + addedStorage)
            return { ...n, usedStorageTB: newUsed }
          }
          return n
        })

        return { connections: updatedConnections, nodes: updatedNodes }
      })
      // Trigger cloud tiering check
      useInfraStore.getState().processCloudTiering()
      // Run AI predictions
      useInfraStore.getState().processAIPredictions()
    }, 1000)
    return () => clearInterval(interval)
  }, [networkLoad])

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-[300px] z-40 bg-[#070f52]/90 border border-[#48afbb]/50 text-white px-4 py-2 rounded-md shadow-lg hover:bg-[#0a1536] transition-colors font-semibold text-sm flex items-center gap-2 backdrop-blur-md"
      >
        <span>📊</span> NOC Dashboard
        {unacknowledgedCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{unacknowledgedCount}</span>}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-6 pb-6 px-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-5xl bg-[#060b18]/98 text-white shadow-2xl backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden flex flex-col" style={{ height: 'min(88vh, 780px)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#070f52] flex-shrink-0">
          <h2 className="font-bold tracking-wide flex items-center gap-2">
            <span>📡</span> NOC Operations Center
          </h2>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors text-lg">
            ✕
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">
          {/* LEFT: Alert Feed & AI Advisor */}
          <div className="w-[340px] flex-shrink-0 border-r border-slate-700/50 flex flex-col bg-slate-900/40">
            <div className="flex border-b border-slate-700/50 bg-[#070f52]">
              <button 
                onClick={() => setActiveAlertTab('active')}
                className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeAlertTab === 'active' ? 'text-white border-b-2 border-teal-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Alerts {unacknowledgedCount > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unacknowledgedCount}</span>}
              </button>
              <button 
                onClick={() => setActiveAlertTab('history')}
                className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeAlertTab === 'history' ? 'text-white border-b-2 border-slate-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
              >
                History
              </button>
              <button 
                onClick={() => setActiveAlertTab('ai' as any)}
                className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${activeAlertTab === ('ai' as any) ? 'text-white border-b-2 border-orange-500 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
              >
                🧠 AI
              </button>
            </div>

            {activeAlertTab === 'active' && unacknowledgedCount > 0 && (
              <div className="px-3 pt-2 pb-1 flex justify-end flex-shrink-0">
                <button 
                  onClick={acknowledgeAllAlerts}
                  className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white px-2 py-0.5 border border-slate-600 rounded bg-slate-800 transition-colors"
                >
                  Acknowledge All
                </button>
              </div>
            )}

            <div className="p-3 space-y-2 flex-1 overflow-y-auto">
              {activeAlertTab === ('ai' as any) ? (
                /* AI Advisor Tab Content */
                <div className="space-y-3">
                  <div className="text-center py-2">
                    <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold">Predictive Intelligence</p>
                    <p className="text-[9px] text-slate-500 mt-1">Monitoring {allHardware.length} nodes</p>
                  </div>
                  
                  {(() => {
                    const atRiskNodes = allHardware.filter(n => (n.failureProbability ?? 0) > 0.3).sort((a, b) => (b.failureProbability ?? 0) - (a.failureProbability ?? 0))
                    
                    if (atRiskNodes.length === 0) {
                      return (
                        <div className="text-center py-6">
                          <p className="text-2xl">✅</p>
                          <p className="text-xs text-slate-500 mt-2">All systems nominal. No predictive alerts.</p>
                        </div>
                      )
                    }

                    return atRiskNodes.map(node => {
                      const prob = (node.failureProbability ?? 0)
                      const life = node.predictedLifeRemaining ?? 720
                      const severity = prob > 0.8 ? 'critical' : prob > 0.6 ? 'high' : 'medium'
                      const barColor = severity === 'critical' ? 'bg-red-500' : severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'
                      
                      return (
                        <div key={node.id} className={`p-2.5 rounded-lg border ${severity === 'critical' ? 'border-red-900/60 bg-red-950/20' : severity === 'high' ? 'border-orange-900/40 bg-orange-950/10' : 'border-amber-900/30 bg-amber-950/10'}`}>
                          <div className="flex justify-between items-start">
                            <button onClick={() => setSelectedNode(node.id)} className="text-[11px] font-bold text-white hover:text-orange-300 transition-colors text-left">
                              {node.name}
                            </button>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${severity === 'critical' ? 'text-red-300 bg-red-900/40' : severity === 'high' ? 'text-orange-300 bg-orange-900/40' : 'text-amber-300 bg-amber-900/40'}`}>
                              {severity}
                            </span>
                          </div>
                          
                          <div className="mt-1.5">
                            <div className="flex justify-between text-[9px] mb-0.5">
                              <span className="text-slate-500">Failure Risk</span>
                              <span className={`font-mono font-bold ${severity === 'critical' ? 'text-red-400' : severity === 'high' ? 'text-orange-400' : 'text-amber-400'}`}>{(prob * 100).toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                              <div className={`h-full transition-all ${barColor}`} style={{ width: `${prob * 100}%` }} />
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-1.5">
                            <span className="text-[9px] text-slate-500">⏱ TTF: <span className="text-slate-300 font-mono">{life < 24 ? `${life}h` : `${Math.floor(life / 24)}d ${life % 24}h`}</span></span>
                            {node.activeMigration ? (
                              <span className="text-[8px] text-white bg-blue-600 px-1.5 py-0.5 rounded font-bold animate-pulse">MIGRATING {node.activeMigration.progress}%</span>
                            ) : prob > 0.8 ? (
                              <span className="text-[8px] text-orange-300 bg-orange-900/40 px-1.5 py-0.5 rounded font-bold">PENDING</span>
                            ) : (
                              <span className="text-[8px] text-slate-500">Monitoring</span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (() => {
                const displayedAlerts = alerts.filter(a => activeAlertTab === 'active' ? !a.isAcknowledged : a.isAcknowledged)

                if (displayedAlerts.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 italic text-center py-8">
                      {activeAlertTab === 'active' ? 'No active alerts. Systems nominal.' : 'No alert history.'}
                    </p>
                  )
                }

                return displayedAlerts.map(alert => {
                  const relatedNode = alert.nodeId ? nodes.find(n => n.id === alert.nodeId) : null
                  return (
                    <div key={alert.id} className={`flex gap-2 items-start p-2 rounded-lg border ${activeAlertTab === 'history' ? 'opacity-50 border-slate-800' : alert.severity === 'critical' ? 'border-red-900/40 bg-red-950/20' : 'border-slate-800 bg-slate-800/20'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-sm ${alert.severity === 'critical' ? 'bg-red-500 animate-pulse shadow-red-500/50' : alert.severity === 'warning' ? 'bg-amber-400 shadow-amber-400/50' : 'bg-blue-400 shadow-blue-400/50'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] leading-snug ${alert.severity === 'critical' ? 'text-red-200' : alert.severity === 'warning' ? 'text-amber-200' : 'text-slate-300'}`}>
                          {alert.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] text-slate-500">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                          {relatedNode && (
                            <button 
                              onClick={() => setSelectedNode(relatedNode.id)}
                              className="text-[8px] font-bold px-1 py-0.5 border border-slate-600 rounded bg-slate-800 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
                            >
                              📍 {relatedNode.name}
                            </button>
                          )}
                          {activeAlertTab === 'active' && (
                            <button 
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="text-[8px] font-bold uppercase tracking-wider text-teal-400 hover:text-teal-300 px-1.5 py-0.5 border border-teal-500/30 rounded bg-teal-900/20 transition-colors ml-auto"
                            >
                              ACK
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* RIGHT: Metrics & Controls */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
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

            <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700/50">
              <h3 className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-2">FinOps — Monthly Spend</h3>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-black text-emerald-400">${totalMonthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-[10px] text-slate-500 pb-1">/mo</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase">On-Prem</p>
                  <p className="text-[10px] text-slate-300 font-mono">${localCostMonthly.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-sky-400 uppercase">Cloud</p>
                  <p className="text-[10px] text-sky-300 font-mono">${cloudCostMonthly.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-400 uppercase">Egress</p>
                  <p className="text-[10px] text-amber-300 font-mono">${egressCostMonthly.toFixed(0)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={simulateRandomFailure}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-[11px] font-semibold text-white transition-colors flex justify-center items-center gap-2"
              >
                <span>⚡</span> Hardware Failure
              </button>
              <button 
                onClick={simulateDataCorruption}
                className="py-1.5 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 rounded text-[11px] font-semibold text-purple-200 transition-colors flex justify-center items-center gap-2"
              >
                <span>🦠</span> Ransomware
              </button>
              <button 
                onClick={triggerSiteDisaster}
                className="py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/40 rounded text-[11px] font-semibold text-red-200 transition-colors flex justify-center items-center gap-2"
              >
                <span>🔥</span> Site Disaster
              </button>
              
              {currentSite?.isDisaster ? (
                <button 
                  onClick={initiateFailover}
                  className="py-1.5 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 rounded text-[11px] font-black text-blue-300 transition-all flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse"
                >
                  <span>🌐</span> FAILOVER
                </button>
              ) : (
                <button 
                  onClick={simulateStressTest}
                  className="py-1.5 bg-orange-900/40 hover:bg-orange-800/60 border border-orange-500/40 rounded text-[11px] font-semibold text-orange-200 transition-colors flex justify-center items-center gap-2"
                >
                  <span>🔬</span> Stress Test
                </button>
              )}
            </div>

            {/* Threat Map */}
            <div className={`p-4 rounded-lg border ${hasActiveThreats ? 'bg-fuchsia-950/40 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.15)]' : 'bg-slate-900/60 border-slate-700/50'}`}>
              <h3 className={`text-[10px] font-bold tracking-widest uppercase mb-2 ${hasActiveThreats ? 'text-fuchsia-400' : 'text-slate-400'}`}>Security — Threat Map</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className={`text-2xl font-black ${infectedCount > 0 ? 'text-fuchsia-400 animate-pulse' : 'text-slate-600'}`}>{infectedCount}</p>
                  <p className="text-[9px] text-fuchsia-400 uppercase">Infected</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-blue-400">{protectedCount}</p>
                  <p className="text-[9px] text-blue-400 uppercase">Protected</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-400">{unprotectedCount}</p>
                  <p className="text-[9px] text-slate-500 uppercase">Exposed</p>
                </div>
              </div>
              {hasActiveThreats && (
                <button 
                  onClick={performMassRollback}
                  className="w-full mt-3 py-2 bg-fuchsia-900/50 hover:bg-fuchsia-800/60 border border-fuchsia-500/50 rounded text-[11px] font-black text-fuchsia-200 transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(217,70,239,0.2)] animate-pulse hover:shadow-[0_0_30px_rgba(217,70,239,0.4)]"
                >
                  <span>🔄</span> PERFORM MASS ROLLBACK
                </button>
              )}
            </div>

            <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700/50">
              <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">Live Traffic Control</h4>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-slate-300">Network Load</span>
                  <span className="text-[10px] text-teal-400 font-mono">{Math.round(networkLoad * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={networkLoad} 
                  onChange={(e) => setNetworkLoad(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
