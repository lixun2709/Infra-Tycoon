import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Award, 
  X, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Globe
} from 'lucide-react'
import { useInfraStore } from '../../store/useInfraStore'
import { CONTRACT_CATALOG, type ContractBlueprint } from '../../physics/contractLibrary'

interface EconomyDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function EconomyDashboard({ isOpen, onClose }: EconomyDashboardProps) {
  const { balance, reputation, activeContracts, acceptContract, cancelContract, nodes } = useInfraStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'marketplace' | 'active'>('overview')

  // Calculate MRR and MRE
  const totalMRR = activeContracts.reduce((sum, c) => {
    const bp = CONTRACT_CATALOG[c.blueprintId]
    return sum + (bp?.monthlyMRR || 0)
  }, 0)

  const totalPowerKW = nodes.reduce((sum, n) => sum + (n.wattage || 0), 0) / 1000
  const estimatedMRE = (totalPowerKW * 0.12 * 30) + (nodes.filter(n => n.type === 'rack').length * 50 * 30)

  const monthlyProfit = totalMRR - estimatedMRE

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-slate-950/40 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div 
            className="w-full max-w-6xl h-[85vh] bg-slate-950 border border-slate-800 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <BarChart3 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Finance & Logistics</h1>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <Globe className="w-3 h-3" /> Site: Primary-DC
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <Award className="w-3 h-3 text-amber-400" /> Rep: {reputation}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-64 border-r border-slate-800 p-6 flex flex-col gap-2 bg-slate-900/10">
                <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={DollarSign} label="Financial Overview" />
                <TabButton active={activeTab === 'marketplace'} onClick={() => setActiveTab('marketplace')} icon={Briefcase} label="Contract Market" />
                <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={CheckCircle2} label="Active Contracts" />
                
                <div className="mt-auto pt-6 border-t border-slate-800">
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Current Balance</p>
                    <p className="text-2xl font-black text-emerald-400">${balance.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto p-10 bg-slate-950/50 custom-scrollbar">
                {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-3 gap-6">
                      <MetricCard label="Monthly Revenue (MRR)" value={`$${totalMRR.toLocaleString()}`} trend={totalMRR > 0 ? 'up' : 'neutral'} icon={TrendingUp} color="text-emerald-400" />
                      <MetricCard label="Operating Expenses (MRE)" value={`$${estimatedMRE.toLocaleString()}`} trend="down" icon={TrendingDown} color="text-rose-400" />
                      <MetricCard label="Net Monthly Profit" value={`$${monthlyProfit.toLocaleString()}`} trend={monthlyProfit >= 0 ? 'up' : 'down'} icon={BarChart3} color={monthlyProfit >= 0 ? 'text-teal-400' : 'text-rose-400'} />
                    </div>

                    <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Financial Statement</h3>
                      <div className="space-y-4">
                        <ExpenseItem label="Energy & Power Usage" amount={-(totalPowerKW * 0.12 * 30)} sub={`${totalPowerKW.toFixed(2)} KW Average Load`} />
                        <ExpenseItem label="Colocation Rack Rental" amount={-(nodes.filter(n => n.type === 'rack').length * 50 * 30)} sub={`${nodes.filter(n => n.type === 'rack').length} Active Racks`} />
                        <div className="h-px bg-slate-800 my-4" />
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Hybrid Cloud Metrics</p>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${useInfraStore.getState().cloudBurstingActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
                            <span className="text-xs font-bold text-white uppercase">Cloud Bursting</span>
                          </div>
                          <button 
                            onClick={() => useInfraStore.getState().setCloudBursting(!useInfraStore.getState().cloudBurstingActive)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${useInfraStore.getState().cloudBurstingActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                          >
                            {useInfraStore.getState().cloudBurstingActive ? 'ACTIVE' : 'ACTIVATE'}
                          </button>
                        </div>
                        <ExpenseItem label="Cloud Instance Payout" amount={-(useInfraStore.getState().activeCloudInstances * 5 * 30)} sub={`${useInfraStore.getState().activeCloudInstances} Virtual Instances`} />
                        <ExpenseItem label="Network Egress Fees" amount={-(useInfraStore.getState().cloudEgressGB * 0.1 * 30)} sub={`${useInfraStore.getState().cloudEgressGB.toFixed(1)} GB Transferred`} />
                        <div className="h-px bg-slate-800 my-4" />
                        <ExpenseItem label="Contract Revenue" amount={totalMRR} sub={`${activeContracts.length} Service Level Agreements`} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'marketplace' && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    {Object.values(CONTRACT_CATALOG).map(bp => (
                      <ContractCard 
                        key={bp.id} 
                        bp={bp} 
                        isLocked={reputation < bp.minReputation}
                        isOwned={activeContracts.some(c => c.blueprintId === bp.id)}
                        onAccept={() => acceptContract(bp.id)}
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'active' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                    {activeContracts.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl">
                        <Briefcase className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-sm">No active service agreements</p>
                        <button onClick={() => setActiveTab('marketplace')} className="mt-4 text-teal-400 hover:text-white transition-colors uppercase text-[10px] font-black">Browse Market &rarr;</button>
                      </div>
                    ) : (
                      activeContracts.map(c => {
                        const bp = CONTRACT_CATALOG[c.blueprintId]
                        return (
                          <div key={c.id} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="w-2 h-12 rounded-full" style={{ backgroundColor: bp?.color }} />
                              <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight">{bp?.name}</h4>
                                <div className="flex gap-4 mt-1">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">SLA Target: {bp?.slaTarget}%</span>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">Uptime: {((c.uptimeTicks / Math.max(1, c.totalTicks)) * 100).toFixed(2)}%</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-12">
                              <div className="text-right">
                                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Status</p>
                                <div className="flex items-center gap-2 justify-end">
                                  <div className={`w-2 h-2 rounded-full ${c.currentStatus === 'healthy' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500 animate-pulse'}`} />
                                  <span className={`text-xs font-black uppercase ${c.currentStatus === 'healthy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {c.currentStatus}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Accrued Penalty</p>
                                <p className="text-sm font-black text-rose-400">-${c.accumulatedPenalty.toLocaleString()}</p>
                              </div>
                              <button 
                                onClick={() => cancelContract(c.id)}
                                className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 transition-all"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-teal-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-black uppercase tracking-tight">{label}</span>
    </button>
  )
}

function MetricCard({ label, value, trend, icon: Icon, color }: any) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
      <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:scale-110 transition-transform">
        <Icon size={80} />
      </div>
      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <div className="flex items-center gap-1.5 mt-4">
        {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
        {trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-400" />}
        <span className="text-[9px] font-bold text-slate-600 uppercase">Live from simulation engine</span>
      </div>
    </div>
  )
}

function ExpenseItem({ label, amount, sub }: any) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-white tracking-tight">{label}</p>
        <p className="text-[10px] text-slate-600 font-bold uppercase">{sub}</p>
      </div>
      <p className={`text-lg font-black ${amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
        {amount > 0 ? '+' : ''}{amount.toLocaleString()}
      </p>
    </div>
  )
}

function ContractCard({ bp, isLocked, isOwned, onAccept }: { bp: ContractBlueprint, isLocked: boolean, isOwned: boolean, onAccept: () => void }) {

  return (
    <div className={`relative bg-slate-900/40 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between transition-all ${isLocked ? 'grayscale opacity-50' : 'hover:border-teal-500/30'}`}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: bp.color }} />
            <div>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter leading-none">{bp.name}</h4>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{bp.tier}</span>
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400">${bp.monthlyMRR.toLocaleString()}<span className="text-[10px] text-slate-500">/mo</span></p>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">{bp.description}</p>
        
        <div className="space-y-4 mb-8">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Requirements</p>
          <div className="flex flex-wrap gap-2">
            {bp.requirements.map((req, i) => (
              <div key={i} className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300">
                {req.count}x {req.appId.toUpperCase()} {req.redundant ? '(Redundant)' : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="flex items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-2xl gap-3">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] font-black text-rose-400 uppercase">Requires Rep: {bp.minReputation}</span>
        </div>
      ) : isOwned ? (
        <div className="flex items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-black text-emerald-400 uppercase">Active Portfolio</span>
        </div>
      ) : (
        <button 
          onClick={onAccept}
          className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl"
        >
          Accept Agreement
        </button>
      )}
    </div>
  )
}
