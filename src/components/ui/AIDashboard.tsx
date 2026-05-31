import { useInfraStore } from '../../store/useInfraStore'
import { X, Cpu, Activity, Network } from 'lucide-react'
import { APPLICATION_CATALOG } from '../../physics/applicationLibrary'

export function AIDashboard() {
  const isAIDashboardOpen = useInfraStore(s => s.isAIDashboardOpen)
  const toggleAIDashboard = useInfraStore(s => s.toggleAIDashboard)
  const applications = useInfraStore(s => s.applications)
  
  if (!isAIDashboardOpen) return null

  // Filter to only AI training applications
  const aiApps = applications.filter(app => {
    const meta = APPLICATION_CATALOG[app.appId]
    return meta && meta.category === 'ai'
  })

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="bg-[#0f172a] border border-emerald-500/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-emerald-500/20 bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-xl font-bold text-emerald-100">AI Cluster Operations</h2>
              <p className="text-xs text-emerald-400/60">High-Density SuperNODE & Infiniband Management</p>
            </div>
          </div>
          <button 
            onClick={toggleAIDashboard}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400">ACTIVE TRAINING JOBS</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">{aiApps.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400">CLUSTER FLOPS</span>
                <Cpu className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {aiApps.reduce((acc, app) => acc + (app.aiFlopsDelivered || 0), 0).toLocaleString()} <span className="text-sm font-medium text-slate-400">TF/s</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400">FABRIC EFFICIENCY</span>
                <Network className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">
                {aiApps.some(app => app.aiStatus === 'stalled') ? <span className="text-amber-500">Degraded (ETH)</span> : <span className="text-emerald-400">Optimal (IB)</span>}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-emerald-300 mb-3 uppercase">Active Training Workloads</h3>
            {aiApps.length === 0 ? (
              <div className="p-8 border border-dashed border-white/10 rounded-lg text-center bg-white/5">
                <Cpu className="w-8 h-8 text-slate-500 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-slate-400">No active AI training jobs running on the cluster.</p>
                <p className="text-xs text-slate-500 mt-1">Deploy an LLM job to H100 SuperNODEs to begin.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aiApps.map(app => {
                  const meta = APPLICATION_CATALOG[app.appId]
                  const pct = Math.min(100, Math.floor(((app.aiEpochs || 0) / 100) * 100))
                  
                  return (
                    <div key={app.id} className="bg-white/5 border border-emerald-500/20 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-emerald-500/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            {meta?.icon}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm">{meta?.name}</h4>
                            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Epochs: {app.aiEpochs || 0} / 100</span>
                              <span>•</span>
                              <span className={app.aiStatus === 'stalled' ? 'text-amber-400' : 'text-emerald-400'}>
                                {app.aiStatus === 'stalled' ? 'Network Bottleneck' : 'Training'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-300">
                            {(app.aiFlopsDelivered || 0).toLocaleString()} TF/s
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase">Throughput</div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${app.aiStatus === 'stalled' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      
                      {app.aiStatus === 'stalled' && (
                        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-200">
                          <strong>WARNING:</strong> Cluster is bottlenecked by standard Ethernet switches. Upgrade core fabric to <strong>Infiniband (IB)</strong> to prevent 80% latency penalty.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  )
}
