import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { 
  AlertCircle, 
  Scale, 
  LayoutDashboard,
  Zap
} from 'lucide-react'
import { Badge, Modal, Tabs, type TabItem, Card, Button } from './base'

export function Dashboard({ onClose }: { onClose: () => void }) {
  const {
    nodes, alerts, acknowledgeAlert, acknowledgeAllAlerts,
    totalPowerKW,
    networkLoad,
    simulationCycle, auditLogs,
    isHeatMapVisible, toggleHeatMap
  } = useInfraStore()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'audit'>('overview')

  const allHardware = nodes.filter(n => n.type !== 'rack' && n.type !== 'cooling')

  const globalHealthyCount = allHardware.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
  const globalHealthIndex = allHardware.length > 0 ? Math.round((globalHealthyCount / allHardware.length) * 100) : 100

  const tabs: TabItem[] = [
    { id: 'overview', label: 'OVERVIEW', icon: <LayoutDashboard size={14} /> },
    { id: 'events', label: 'EVENTS', icon: <AlertCircle size={14} /> },
    { id: 'audit', label: 'AUDIT LOGS', icon: <Scale size={14} /> },
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
          <Badge variant="ghost" className="bg-white/5 border border-white/10 font-mono text-[10px] py-1 text-slate-400">
            SIM_TICK: {simulationCycle}
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
                  <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest">
                    Fabric Throughput Monitoring Active
                  </p>
                </Card>
              </div>

              {/* Facility Status */}
              <Card title="Facility Utilization" subtitle="Aggregate Site Power Load">
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
              </Card>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="grid grid-cols-2 gap-8 h-full">
              <div className="space-y-4 flex flex-col">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Active Incidents</h3>
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
                            <span className="text-[9px] font-mono text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                            <Button variant="ghost" className="h-7 text-[9px]" onClick={() => acknowledgeAlert(alert.id)}>RESOLVE</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-4 flex flex-col opacity-60 hover:opacity-100 transition-opacity">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2">Incident History</h3>
                <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  {alerts.filter(a => a.isAcknowledged).map(alert => (
                    <Card key={alert.id} glass={false} className="bg-white/5">
                      <p className="text-[10px] text-slate-400">{alert.message}</p>
                      <p className="text-[8px] font-mono text-slate-600 mt-2">{new Date(alert.timestamp).toLocaleString()}</p>
                    </Card>
                  ))}
                </div>
              </div>
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
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mt-1">
                          Cycle {simulationCycle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
