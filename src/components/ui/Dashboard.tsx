import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { 
  LayoutDashboard,
  Zap,
  Activity,
  Clock,
  ShieldAlert,
  HardDrive,
  Layers,
  Globe,
  FileText,
  PlayCircle,
  Settings,
  Database
} from 'lucide-react'
import { Badge, Modal, Tabs, type TabItem, Card, Button } from './base'
import { performanceMonitor } from '../../simulation/PerformanceMonitor'
import type { PerformanceMetrics } from '../../simulation/PerformanceMonitor'
import { ObservabilityDashboard } from './ObservabilityDashboard'
import { LevelUpOverlay } from './LevelUpOverlay'

function SparklineChart({ data, color = '#10b981', height = 40, maxVal = 100 }: { data: number[], color?: string, height?: number, maxVal?: number }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, maxVal, 0.001)
  const min = 0
  const width = 240
  const step = width / Math.max(1, data.length - 1)
  
  // Create bezier curve points for a smooth line instead of jagged edges
  const points = data.map((val, idx) => {
    const x = idx * step
    const y = height - ((val - min) / (max - min)) * height
    return `${x},${y}`
  }).join(' L ')

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div 
      className="w-full mt-3 overflow-visible relative" 
      style={{ height: `${height}px` }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path
          d={`M 0,${height} L ${points} L ${width},${height} Z`}
          fill={`url(#gradient-${color.replace('#', '')})`}
          className="transition-all duration-300"
        />
        <path
          d={`M ${points}`}
          fill="none"
          stroke={color}
          strokeWidth="2"
          className="transition-all duration-300 drop-shadow-md"
        />
        {data.length > 0 && (
          <circle
            cx={width}
            cy={height - (((data[data.length - 1] ?? 0) - min) / (max - min)) * height}
            r="3"
            fill={color}
            className="drop-shadow-md"
          />
        )}
        
        {/* Interactive Hover Zones */}
        {data.map((val, idx) => (
          <rect
            key={idx}
            x={idx * step - (step / 2)}
            y={0}
            width={step}
            height={height}
            fill="transparent"
            className="cursor-crosshair"
            onMouseEnter={() => setHoverIdx(idx)}
          />
        ))}

        {/* Hover Line */}
        {hoverIdx !== null && (
          <line
            x1={hoverIdx * step}
            y1={0}
            x2={hoverIdx * step}
            y2={height}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity={0.5}
          />
        )}

        {/* Hover Point */}
        {hoverIdx !== null && (
          <circle
            cx={hoverIdx * step}
            cy={height - (((data[hoverIdx] ?? 0) - min) / (max - min)) * height}
            r="4"
            fill={color}
            stroke="#fff"
            strokeWidth="2"
          />
        )}
      </svg>
      
      {/* Tooltip */}
      <AnimatePresence>
        {hoverIdx !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="absolute -top-8 px-2 py-1 bg-slate-900 border border-slate-700 text-white text-[9px] font-mono font-bold rounded shadow-xl pointer-events-none whitespace-nowrap z-50"
            style={{ left: `${Math.min(Math.max(hoverIdx * step - 20, 0), width - 40)}px` }}
          >
            {data[hoverIdx].toFixed(1)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Dashboard({ 
  onClose,
  initialTab = 'overview'
}: { 
  onClose: () => void
  initialTab?: 'overview' | 'events' | 'audit' | 'diagnostics' | 'observability'
}) {
  const {
    alerts, acknowledgeAlert, acknowledgeAllAlerts,
    totalPowerKW,
    networkLoad,
    realTimePlayedSeconds, auditLogs,
    isHeatMapVisible, toggleHeatMap,
    timeFormat,
    incidents, postMortems, sites,
    triggerSiteFailover, triggerPowerFailureDrill, triggerHVACFailureDrill
  } = useInfraStore(useShallow(state => ({
    alerts: state.alerts, acknowledgeAlert: state.acknowledgeAlert, acknowledgeAllAlerts: state.acknowledgeAllAlerts,
    totalPowerKW: state.totalPowerKW,
    networkLoad: state.networkLoad,
    realTimePlayedSeconds: state.realTimePlayedSeconds, auditLogs: state.auditLogs,
    isHeatMapVisible: state.isHeatMapVisible, toggleHeatMap: state.toggleHeatMap,
    timeFormat: state.timeFormat,
    incidents: state.incidents, postMortems: state.postMortems, sites: state.sites,
    triggerSiteFailover: state.triggerSiteFailover,
    triggerPowerFailureDrill: state.triggerPowerFailureDrill,
    triggerHVACFailureDrill: state.triggerHVACFailureDrill
  })))

  const formatUptime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    const pad = (num: number) => String(num).padStart(2, '0')
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
    return `${pad(m)}:${pad(s)}`
  }

  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'audit' | 'diagnostics' | 'observability'>(initialTab)
  const [eventSubTab, setEventSubTab] = useState<'alerts' | 'incidents' | 'postmortems' | 'drills'>('alerts')

  const [metrics, setMetrics] = useState<PerformanceMetrics>(performanceMonitor.getMetrics())

  const nodes = useInfraStore.getState().nodes
  useInfraStore(s => s.nodes.length)
  const allHardware = nodes.filter((n: import('../../store/infraTypes').InfraNode) => n.type !== 'rack' && n.type !== 'cooling')
  const globalHealthyCount = allHardware.filter((n: import('../../store/infraTypes').InfraNode) => n.healthStatus === 'healthy' || !n.healthStatus).length
  const globalHealthIndex = allHardware.length > 0 ? Math.round((globalHealthyCount / allHardware.length) * 100) : 100

  const [powerHistory, setPowerHistory] = useState<number[]>([totalPowerKW, totalPowerKW, totalPowerKW, totalPowerKW, totalPowerKW])
  const [networkHistory, setNetworkHistory] = useState<number[]>([networkLoad, networkLoad, networkLoad, networkLoad, networkLoad])
  const [healthHistory, setHealthHistory] = useState<number[]>([globalHealthIndex, globalHealthIndex, globalHealthIndex, globalHealthIndex, globalHealthIndex])
  const [fpsHistory, setFpsHistory] = useState<number[]>([60, 60, 60, 60, 60])

  useEffect(() => {
    const interval = setInterval(() => {
      setPowerHistory(prev => [...prev.slice(-24), totalPowerKW])
      setNetworkHistory(prev => [...prev.slice(-24), networkLoad])
      setHealthHistory(prev => [...prev.slice(-24), globalHealthIndex])
      setFpsHistory(prev => [...prev.slice(-24), performanceMonitor.getMetrics().fps])
    }, 1000)
    return () => clearInterval(interval)
  }, [totalPowerKW, networkLoad, globalHealthIndex])

  useEffect(() => {
    if (activeTab !== 'diagnostics') return
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics())
    }, 500)
    return () => clearInterval(interval)
  }, [activeTab])

  const formatBytes = (bytes?: number): string => {
    if (bytes === undefined) return 'N/A'
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      case 'restarting': return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      case 'failed': return 'text-rose-400 border-rose-500/30 bg-rose-500/10'
      default: return 'text-slate-500 border-slate-700 bg-slate-800/50'
    }
  }

  const activeAlerts = alerts.filter(a => !a.isAcknowledged).length

  const tabs: TabItem[] = [
    { id: 'overview', label: 'OVERVIEW', icon: <LayoutDashboard size={14} /> },
    { id: 'events', label: activeAlerts > 0 ? `EVENTS (${activeAlerts})` : 'EVENTS', icon: <ShieldAlert size={14} /> },
    { id: 'observability', label: 'OBSERVABILITY', icon: <Activity size={14} /> },
    { id: 'audit', label: 'AUDIT LOGS', icon: <Layers size={14} /> },
    { id: 'diagnostics', label: 'DIAGNOSTICS', icon: <Activity size={14} /> },
  ]

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="NOC Operations"
      icon={<LayoutDashboard size={20} />}
      width="xl"
      zIndex="z-[150]"
      headerExtra={
        <>
          <LevelUpOverlay />
          <Badge variant="ghost" className="bg-white/5 border border-white/10 font-mono text-[10px] py-1 text-slate-400">
            UPTIME: {formatUptime(realTimePlayedSeconds)}
          </Badge>
          <button 
            onClick={toggleHeatMap}
            className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border transition-all flex items-center gap-1.5 ${isHeatMapVisible ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-slate-800 text-slate-400 border-transparent hover:text-white hover:bg-slate-700'}`}
          >
            <Zap size={12} /> Thermal Cam
          </button>
        </>
      }
    >
      <div className="flex flex-col h-[75vh]">

        <Tabs 
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
          variant="underline"
          className="bg-black/20"
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-6">
                <Card title="Global Health" subtitle="Hardware Status Index">
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className={`text-4xl font-black ${globalHealthIndex > 80 ? 'text-teal-400' : 'text-rose-400'}`}>
                      {globalHealthIndex}%
                    </span>
                    <Badge variant={globalHealthIndex > 80 ? 'success' : 'warning'}>NOMINAL</Badge>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${globalHealthIndex > 80 ? 'bg-teal-500' : 'bg-rose-500'}`}
                      style={{ width: `${globalHealthIndex}%` }}
                    />
                  </div>
                  <SparklineChart data={healthHistory} color={globalHealthIndex > 80 ? '#14b8a6' : '#ef4444'} maxVal={100} />
                  <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest">
                    {globalHealthyCount} / {allHardware.length} Nodes Operational
                  </p>
                </Card>

                <Card title="SLA Compliance" subtitle="Contract Reliability">
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-black text-teal-400">99.99%</span>
                    <Badge variant="success">STABLE</Badge>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div className="bg-teal-500 h-full" style={{ width: '99.9%' }} />
                  </div>
                  <SparklineChart data={[99.98, 99.99, 99.99, 99.98, 99.99, 99.99]} color="#10b981" maxVal={100} />
                  <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest">Zero Violations in Current Cycle</p>
                </Card>

                <Card title="Resource Load" subtitle="Global Network Load">
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-black text-amber-400">{(networkLoad * 100).toFixed(1)}%</span>
                    <Badge variant="warning">PEAK</Badge>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                      style={{ width: `${networkLoad * 100}%` }} 
                    />
                  </div>
                  <SparklineChart data={networkHistory.map(n => n * 100)} color="#f59e0b" maxVal={100} />
                  <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest">
                    Fabric Throughput Monitoring Active
                  </p>
                </Card>
              </div>

              {/* Facility Status */}
              <Card title="Facility Utilization" subtitle="Aggregate Site Power Load">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <span className="text-6xl font-black text-white tracking-tighter">
                        {(totalPowerKW).toFixed(1)}
                        <span className="text-2xl text-slate-600 ml-2">kW</span>
                      </span>
                      <Badge variant={totalPowerKW > 80 ? 'error' : 'success'} glow className="mb-2">
                        {totalPowerKW > 80 ? 'CRITICAL' : 'OPTIMAL'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-12 text-right">
                      <div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Density</p>
                        <p className="text-xl font-black text-slate-200">
                          {nodes.filter(n => n.parentRackId).length} Units
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Efficiency</p>
                        <p className="text-xl font-black text-teal-500">1.12 PUE</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Capacity</p>
                        <p className="text-xl font-black text-slate-200">100kW</p>
                      </div>
                    </div>
                  </div>
                  <SparklineChart data={powerHistory} color="#ff5a36" maxVal={50} height={50} />
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="flex flex-col h-full gap-6">
              {/* Sub-navigation */}
              <div className="flex gap-3 px-2 border-b border-white/10 pb-4">
                <button onClick={() => setEventSubTab('alerts')} className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg border transition-all flex items-center gap-2 ${eventSubTab === 'alerts' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-slate-800/50 text-slate-500 border-transparent hover:bg-slate-800 hover:text-slate-300'}`}>
                  <ShieldAlert size={14} /> Alerts
                </button>
                <button onClick={() => setEventSubTab('incidents')} className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg border transition-all flex items-center gap-2 ${eventSubTab === 'incidents' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'bg-slate-800/50 text-slate-500 border-transparent hover:bg-slate-800 hover:text-slate-300'}`}>
                  <Activity size={14} /> Major Incidents
                  {incidents.filter(i => !i.isResolved).length > 0 && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>
                <button onClick={() => setEventSubTab('postmortems')} className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg border transition-all flex items-center gap-2 ${eventSubTab === 'postmortems' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-800/50 text-slate-500 border-transparent hover:bg-slate-800 hover:text-slate-300'}`}>
                  <FileText size={14} /> Post-Mortems
                </button>
                <button onClick={() => setEventSubTab('drills')} className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg border transition-all flex items-center gap-2 ${eventSubTab === 'drills' ? 'bg-teal-500/20 text-teal-400 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'bg-slate-800/50 text-slate-500 border-transparent hover:bg-slate-800 hover:text-slate-300'}`}>
                  <PlayCircle size={14} /> Drill Operations
                </button>
              </div>

              {eventSubTab === 'alerts' && (
                <div className="grid grid-cols-2 gap-8 flex-1 min-h-0">
                  <div className="space-y-4 flex flex-col min-h-0">
                    <div className="flex justify-between items-center px-2 shrink-0">
                      <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Active Alerts</h3>
                      <Button variant="ghost" className="text-[9px]" onClick={acknowledgeAllAlerts}>PURGE ALL</Button>
                    </div>
                    <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                      {alerts.filter(a => !a.isAcknowledged).map(alert => (
                        <Card key={alert.id} className={`${alert.severity === 'critical' ? 'border-rose-500/20' : ''}`}>
                          <div className="flex gap-4">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${alert.severity === 'critical' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'}`} />
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-slate-200 leading-relaxed">{alert.message}</p>
                              <div className="flex justify-between items-center mt-3">
                                <span className="text-[9px] font-mono text-slate-500">
                                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12h' })}
                                </span>
                                <Button variant="ghost" className="h-7 text-[9px]" onClick={() => acknowledgeAlert(alert.id)}>RESOLVE</Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col min-h-0 opacity-60 hover:opacity-100 transition-opacity">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 shrink-0">Alert History</h3>
                    <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                      {alerts.filter(a => a.isAcknowledged).map(alert => (
                        <Card key={alert.id} glass={false} className="bg-white/5">
                          <p className="text-[10px] text-slate-400">{alert.message}</p>
                          <p className="text-[8px] font-mono text-slate-600 mt-2">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12h' })}
                          </p>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {eventSubTab === 'incidents' && (
                <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  {incidents.filter(i => !i.isResolved).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border border-white/5 rounded-2xl bg-white/5">
                      <ShieldAlert className="w-8 h-8 text-emerald-500 mb-3 opacity-50" />
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">No Active Incidents</p>
                      <p className="text-[10px] text-slate-500 mt-2">All systems operating within normal parameters.</p>
                    </div>
                  ) : (
                    incidents.filter(i => !i.isResolved).map(incident => (
                      <Card key={incident.id} className="border-rose-500/30 bg-rose-950/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
                        <div className="flex gap-6">
                          <div className="flex flex-col items-center justify-center shrink-0 w-24 border-r border-rose-500/20 pr-6">
                            <Activity className="w-8 h-8 text-rose-500 mb-2 animate-pulse" />
                            <Badge variant="error" className="animate-pulse">SEV-1</Badge>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="text-lg font-black text-rose-400 uppercase tracking-tight">{incident.type.replace(/_/g, ' ')}</h3>
                                <p className="text-sm font-medium text-rose-200/80 mt-1">Critical failure impacting {incident.affectedNodes.length} nodes</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">RTO Timer</p>
                                <p className="text-xl font-mono font-black text-white">
                                  {Math.floor((incident.rtoTargetSeconds || 0) / 60)}:{((incident.rtoTargetSeconds || 0) % 60).toString().padStart(2, '0')}
                                </p>
                              </div>
                            </div>
                            {[incident.siteId].map(siteId => {
                              const site = sites.find(s => s.id === siteId)
                              const targetSite = sites.find(s => s.id !== siteId)?.id || 'site-1'
                              return (
                                <div key={siteId} className="mt-4 p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-bold text-white flex items-center gap-2">
                                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                                      {site?.name || siteId}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">Total Failure Detected. Failover required.</p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    className="bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500 hover:text-white"
                                    onClick={() => triggerSiteFailover(siteId, targetSite)}
                                  >
                                    EXECUTE FAILOVER
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {eventSubTab === 'postmortems' && (
                <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  {postMortems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 border border-white/5 rounded-2xl bg-white/5">
                      <FileText className="w-8 h-8 text-slate-600 mb-3" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Post-Mortems Available</p>
                    </div>
                  ) : (
                    postMortems.map(pm => (
                      <Card key={pm.id} className="opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Incident Report</p>
                            <h3 className="text-sm font-bold text-white">Incident #{pm.incidentNumber}</h3>
                          </div>
                          <Badge variant="ghost" className="bg-white/5">
                            {new Date(pm.timestamp).toLocaleDateString()}
                          </Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {pm.rca}
                        </div>
                        <div className="mt-4 flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ShieldAlert size={12} /> RTO Met: Yes
                          </span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Settings size={12} /> Root Cause Analysis Complete
                          </span>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {eventSubTab === 'drills' && (
                <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  <Card className="border-violet-500/30 bg-violet-950/10 hover:bg-violet-950/20 cursor-pointer group transition-all" onClick={() => triggerPowerFailureDrill(sites[0]?.id || 'site-1')}>
                    <div className="flex flex-col h-full items-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6 text-violet-400" />
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">Power Failure Drill</h4>
                      <p className="text-[10px] text-slate-400 mb-6">Simulates a complete loss of utility power. Tests UPS endurance and generator startup sequencing.</p>
                      <Button variant="ghost" className="w-full mt-auto bg-violet-500/20 text-violet-300 border-violet-500/30 group-hover:bg-violet-500 group-hover:text-white transition-colors">
                        INITIATE DRILL
                      </Button>
                    </div>
                  </Card>
                  
                  <Card className="border-cyan-500/30 bg-cyan-950/10 hover:bg-cyan-950/20 cursor-pointer group transition-all" onClick={() => triggerHVACFailureDrill(sites[0]?.id || 'site-1')}>
                    <div className="flex flex-col h-full items-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Settings className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">HVAC Failure Drill</h4>
                      <p className="text-[10px] text-slate-400 mb-6">Simulates a catastrophic cooling failure. Tests thermal mass resilience and thermal throttling response.</p>
                      <Button variant="ghost" className="w-full mt-auto bg-cyan-500/20 text-cyan-300 border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        INITIATE DRILL
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <Card title="Security Audit Trail" subtitle="Immutable Compliance Logs">
                <div className="space-y-1">
                  {auditLogs.map(log => (
                    <div key={log.id} className="py-4 border-b border-white/5 last:border-0 flex items-start justify-between gap-6 hover:bg-white/5 px-4 -mx-4 rounded-lg transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <Badge variant={log.status === 'Blocked' ? 'error' : 'success'}>{log.type}</Badge>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                            {log.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200">{log.message}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12h' })}
                        </p>
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mt-1">
                          AUDIT TRAIL
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="grid grid-cols-2 gap-8 font-mono text-[11px] text-slate-300">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Host Metrics Card */}
                <Card title="Host Diagnostics" subtitle="Main Thread & Memory performance">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 border border-slate-900/40 rounded-xl p-3 flex flex-col justify-between h-32">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider font-bold">Main Thread</span>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className={`${metrics.fps > 55 ? 'text-emerald-400' : 'text-amber-400'} text-base font-bold`}>{metrics.fps}</span>
                        <span className="text-[9px] text-slate-500">FPS ({metrics.frameTime.toFixed(1)}ms)</span>
                      </div>
                      <SparklineChart data={fpsHistory} color={metrics.fps > 55 ? '#10b981' : '#f59e0b'} height={25} maxVal={60} />
                      <div className="flex justify-between text-[9px] text-slate-400/90 border-t border-slate-800/40 pt-1 mt-1">
                        <span>1% Low: <span className="font-bold text-amber-500">{metrics.onePercentLowFps ?? metrics.fps}</span></span>
                        <span>Jitter: <span className="font-bold text-sky-400">{metrics.frameJitter?.toFixed(1) ?? '0.0'}ms</span></span>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-900/40 rounded-xl p-3 flex flex-col justify-between h-20">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[9px] uppercase tracking-wider font-bold">JS Heap Memory</span>
                        <HardDrive className="w-3.5 h-3.5 text-sky-400 opacity-60" />
                      </div>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-sky-400 font-bold text-xs">{formatBytes(metrics.usedJSHeapSize)}</span>
                        <span className="text-[8px] text-slate-500">of {formatBytes(metrics.totalJSHeapSize)}</span>
                      </div>
                      <div className="text-[8px] text-slate-500/85 border-t border-slate-800/40 pt-1 mt-1 text-right">
                        Limit: {formatBytes(metrics.jsHeapSizeLimit)}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Worker Diagnostics Card */}
                <Card title="Simulation Worker Thread" subtitle="Background ECS compute engine state">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900/50 mb-3">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      Worker Execution
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${getStatusColor(metrics.workerStatus)}`}>
                      {metrics.workerStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] bg-slate-900/20 p-2.5 rounded-xl border border-slate-900/25">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 opacity-40" /> Tick duration
                      </span>
                      <span className="text-indigo-400 font-semibold">
                        {metrics.simTickTime === 0 || metrics.simTickTime < 0.001 
                          ? '< 0.001ms' 
                          : `${metrics.simTickTime.toFixed(3)}ms`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Zap className="w-3 h-3 opacity-40" /> Thread latency
                      </span>
                      <span className="text-slate-300 font-semibold">{metrics.workerLatency.toFixed(1)}ms</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Database className="w-3 h-3 opacity-40" /> Total entities
                      </span>
                      <span className="text-slate-300 font-semibold">{metrics.entityCount}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 opacity-40 text-rose-400" /> Dropped ticks
                      </span>
                      <span className={`font-semibold ${metrics.droppedTicks > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                        {metrics.droppedTicks ?? 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-center col-span-2 border-t border-slate-900/50 pt-2 mt-1">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Zap className="w-3 h-3 opacity-40 text-amber-400" /> Backpressure Ratio
                      </span>
                      <span className={`font-semibold ${metrics.backpressureRatio > 0.1 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                        {((metrics.backpressureRatio ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Deterministic Simulation Stats */}
                {metrics.simStats && (
                  <Card title="Deterministic Simulation" subtitle="Day 35 ECS Aggregated Telemetry">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-900/50 mb-3">
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                        Operating Health Index
                      </span>
                      <span className="text-sky-400 font-bold text-[10px]">
                        {(metrics.simStats.averageUptimeRatio * 100).toFixed(1)}% UPTIME
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] bg-slate-900/20 p-2.5 rounded-xl border border-slate-900/25">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Power Draw</span>
                        <span className="text-amber-400 font-semibold">{metrics.simStats.totalPowerDrawKW.toFixed(2)} kW</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Hotspots Count</span>
                        <span className={`font-semibold ${metrics.simStats.overheatedNodeCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                          {metrics.simStats.overheatedNodeCount}
                        </span>
                      </div>

                      <div className="flex justify-between items-center col-span-2 border-t border-slate-900/50 pt-2 mt-1">
                        <span className="text-slate-500">Aggregated Storage</span>
                        <span className="text-slate-300">
                          {metrics.simStats.totalStorageUsedTB.toFixed(1)} / {metrics.simStats.totalStorageCapacityTB.toFixed(1)} TB
                        </span>
                      </div>

                      <div className="flex justify-between items-center col-span-2">
                        <span className="text-slate-500">Congested Link Count</span>
                        <span className={`font-semibold ${metrics.simStats.congestedLinkCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                          {metrics.simStats.congestedLinkCount}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* WebGL & Graphics */}
                <Card title="WebGL Graphics Renderer" subtitle="Three.js 3D pipeline telemetry">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] bg-slate-900/20 p-2.5 rounded-xl border border-slate-900/25">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Draw Calls</span>
                      <span className="text-amber-400 font-bold">{metrics.drawCalls}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Triangles Count</span>
                      <span className="text-slate-300 font-semibold">{metrics.triangles.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center col-span-2 border-t border-slate-900/50 pt-2 mt-1">
                      <span className="text-slate-500">Geometries Load</span>
                      <span className="text-slate-300 font-semibold">{metrics.geometries}</span>
                    </div>

                    <div className="flex justify-between items-center col-span-2">
                      <span className="text-slate-500">Textures Load</span>
                      <span className="text-slate-300 font-semibold">{metrics.textures}</span>
                    </div>
                  </div>
                </Card>

                {/* ECS Query Cache & Multiplayer */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/25 border border-slate-900/30 rounded-2xl p-4 space-y-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5 border-b border-slate-900/55 pb-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      ECS Query Cache
                    </span>
                    <div className="text-[10px] text-emerald-400 font-bold mt-1">
                      {(metrics.cacheHitRatio * 100).toFixed(1)}% HIT RATE
                    </div>
                    <div className="text-[9px] text-slate-500 space-y-0.5 pt-1">
                      <div>Active Queries: {metrics.activeQueries}</div>
                      <div>Hits / Misses: {metrics.queryHits} / {metrics.queryMisses}</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/25 border border-slate-900/30 rounded-2xl p-4 space-y-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5 border-b border-slate-900/55 pb-1">
                      <Globe className="w-3.5 h-3.5 text-pink-400" />
                      Multiplayer State
                    </span>
                    <div className="text-[10px] text-pink-400 font-bold mt-1">
                      READY / LOCALHOST
                    </div>
                    <div className="text-[9px] text-slate-500 space-y-0.5 pt-1">
                      <div>Ping RTT: 0.0 ms</div>
                      <div>Packet Loss: 0.00%</div>
                    </div>
                  </div>
                </div>

                {/* Subsystem timings */}
                {Object.keys(metrics.systemTimings).length > 0 && (
                  <Card title="ECS Subsystem Timing Profile" subtitle="Background execution breakdown">
                    <div className="space-y-2 text-[10px]">
                      {Object.entries(metrics.systemTimings).map(([name, time]) => (
                        <div key={name} className="flex flex-col gap-1">
                          <div className="flex justify-between font-mono">
                            <span className="truncate max-w-[150px] text-slate-400 font-semibold">{name}</span>
                            <span className="text-slate-300">
                              {(time as number) === 0 || (time as number) < 0.0001 
                                ? '< 0.0001ms' 
                                : `${(time as number).toFixed(4)}ms`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 h-1 rounded overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded transition-all duration-300"
                              style={{ 
                                width: `${metrics.simTickTime > 0 
                                  ? Math.min(100, ((time as number) / metrics.simTickTime) * 100) 
                                  : 0}%` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {activeTab === 'observability' && (
            <div className="h-full flex flex-col">
              <ObservabilityDashboard />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
