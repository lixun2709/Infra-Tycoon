import { useInfraStore, type Gig } from '../../store/useInfraStore'

import { 
  Briefcase, 
  Database, 
  Globe, 
  ShieldCheck, 
  TrendingUp, 
  Activity
} from 'lucide-react'

const AVAILABLE_GIGS: Gig[] = [
  {
    id: 'gig-media-archive',
    name: 'Enterprise Media Archive',
    reward: 400,
    serviceRequirements: [{ type: 'storage', count: 1 }]
  },
  {
    id: 'gig-web-cluster',
    name: 'High-Traffic Web Cluster',
    reward: 600,
    serviceRequirements: [{ type: 'web', count: 2 }]
  },
  {
    id: 'gig-dr-vault',
    name: 'Disaster Recovery Vault',
    reward: 450,
    serviceRequirements: [{ type: 'backup', count: 1 }]
  }
]

export function Marketplace() {
  const { activeContracts, cashBalance, lastTickProfit, acceptContract, nodes, connections } = useInfraStore()

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#020617] custom-scrollbar">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
              <span className="p-3 bg-teal-500 rounded-2xl text-slate-900 shadow-[0_0_30px_rgba(20,184,166,0.3)]">
                <Briefcase size={32} />
              </span>
              INFRA MARKETPLACE
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] mt-3 text-xs">Autonomous Service Exchange v4.0</p>
          </div>
          
          <div className="flex gap-6">
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Corporate Balance</p>
              <p className="text-2xl font-black text-emerald-400">${cashBalance.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Last Tick Performance</p>
              <p className={`text-2xl font-black ${lastTickProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                {lastTickProfit >= 0 ? '+' : ''}${Math.round(lastTickProfit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Job Board */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="text-teal-500" size={16} />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Contracts</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {AVAILABLE_GIGS.map((gig) => {
              const isAccepted = activeContracts.some(c => c.id === gig.id)
              return (
                <div 
                  key={gig.id}
                  className={`group p-6 rounded-3xl border-2 transition-all ${
                    isAccepted 
                    ? 'bg-slate-900/20 border-slate-800 opacity-60' 
                    : 'bg-slate-900/40 border-slate-800 hover:border-teal-500/50 hover:shadow-[0_0_40px_rgba(20,184,166,0.1)]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-5">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-teal-500 group-hover:scale-110 transition-transform">
                        {gig.serviceRequirements?.[0]?.type === 'storage' ? <Database /> : <Globe />}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white tracking-tight">{gig.name}</h3>
                        <div className="flex gap-4 mt-2">
                          {gig.serviceRequirements?.map((req, i) => (
                            <span key={i} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                              {req.count}x {req.type} instance
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-400 tracking-tighter">${gig.reward}<span className="text-[10px] text-slate-600 font-bold ml-1">/TICK</span></p>
                      <button
                        disabled={isAccepted}
                        onClick={() => acceptContract(gig)}
                        className={`mt-4 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          isAccepted 
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                          : 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-900/20'
                        }`}
                      >
                        {isAccepted ? 'Contract Active' : 'Sign Agreement'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Active SLAs */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-purple-500" size={16} />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">SLA Performance</h2>
          </div>

          <div className="bg-slate-900/40 border-2 border-slate-800 rounded-3xl p-6">
            {!activeContracts.length ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                  <TrendingUp className="text-slate-700" size={24} />
                </div>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">No active obligations</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activeContracts.map(gig => {
                  let satisfied = true
                  gig.serviceRequirements?.forEach(req => {
                    const providers = nodes.filter(n => n.services?.some(s => s.type === req.type && s.status === 'running'))
                    const reachable = providers.filter(n => {
                      const hasUpPort = n.ports.some(p => p.status === 'up')
                      const hasConn = connections.some(c => c.startNodeId === n.id || c.endNodeId === n.id)
                      return hasUpPort && hasConn
                    })
                    if (reachable.length < req.count) satisfied = false
                  })

                  return (
                    <div key={gig.id} className="group">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight truncate max-w-[150px]">{gig.name}</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${satisfied ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'}`}>
                          {satisfied ? 'Compliant' : 'Violation'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full transition-all duration-1000 ${satisfied ? 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]' : 'bg-rose-500'}`} 
                          style={{ width: satisfied ? '100%' : '30%' }} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-6 bg-indigo-950/20 border-2 border-indigo-500/20 rounded-3xl">
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe size={12} /> Regional Reachability
            </h4>
            <p className="text-[11px] text-indigo-200/70 leading-relaxed">
              Revenue is only recognized when service instances are physically reachable via the network fabric. Ensure local uplinks and cross-region fiber are operational.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
