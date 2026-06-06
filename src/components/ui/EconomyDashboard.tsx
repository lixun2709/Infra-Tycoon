/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { Modal, Tabs, type TabItem } from './system'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Award, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Globe,
  X
} from 'lucide-react'
import { useInfraStore } from '../../store/useInfraStore'
import { useGameplayStore } from '../../store/useGameplayStore'
import { useTelemetryStore } from '../../store/useTelemetryStore'
import { useShallow } from 'zustand/react/shallow'
import { CONTRACT_CATALOG, type ContractBlueprint } from '../../physics/contractLibrary'
import { getReputationTier } from '../../store/slices/economySlice'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'

interface EconomyDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function EconomyDashboard({ isOpen, onClose }: EconomyDashboardProps) {
  const { balance, reputation, reputationHistory, activeContracts, marketContracts, acceptContract, cancelContract, loans, takeLoan, repayLoan, companyLevel } = useInfraStore(useShallow(state => ({
    balance: state.balance,
    reputation: state.reputation,
    activeContracts: state.activeContracts,
    marketContracts: state.marketContracts || [],
    loans: state.loans || [],
    acceptContract: state.acceptContract,
    cancelContract: state.cancelContract,
    takeLoan: state.takeLoan,
    repayLoan: state.repayLoan,
    companyLevel: state.companyLevel,
    reputationHistory: state.reputationHistory || []
  })))
  const [activeTab, setActiveTab] = useState<'overview' | 'marketplace' | 'active' | 'banking' | 'reputation'>('overview')

  // Calculate MRR and MRE
  const totalMRR = activeContracts.reduce((sum: any, c: any) => {
    const bp = CONTRACT_CATALOG[c.blueprintId]
    return sum + (bp?.monthlyMRR || 0)
  }, 0)

  const { totalPowerKW, rackCount, throttledNodeCount, totalDegradationPenalty, activeCloudInstances, cloudEgressGB, cloudBurstingActive } = useInfraStore(useShallow(state => {
    let powerW = 0
    let rCount = 0
    let throttled = 0
    let degradationPenalty = 0

    for (const n of state.nodes) {
      powerW += (n.wattage || 0)
      if (n.type === 'rack') rCount++
      if (n.type !== 'rack' && n.type !== 'cooling') {
        const throttleMult = n.isThrottled ? 2.5 : 1.0
        const degMult = 1 + ((n.degradation || 0) / 100)
        degradationPenalty += (100 * throttleMult * degMult)
        if (n.isThrottled) throttled++
      }
    }

    return {
      totalPowerKW: powerW / 1000,
      rackCount: rCount,
      throttledNodeCount: throttled,
      totalDegradationPenalty: degradationPenalty,
      activeCloudInstances: state.activeCloudInstances,
      cloudEgressGB: state.cloudEgressGB,
      cloudBurstingActive: state.cloudBurstingActive
    }
  }))

  const powerCostPerMonth = totalPowerKW * 90
  const rackRentPerMonth = rackCount * 500
  const maintenanceCostPerMonth = totalDegradationPenalty
  const cloudCostPerMonth = cloudBurstingActive ? (activeCloudInstances * 300) : 0
  const egressCostPerMonth = cloudEgressGB * 0.1 * 3600

  const totalLoanPayment = loans.reduce((sum: any, loan: any) => {
    const interest = loan.remainingAmount * loan.interestRate
    return sum + Math.max(interest, loan.minimumMonthlyPayment)
  }, 0)

  const estimatedMRE = powerCostPerMonth + rackRentPerMonth + maintenanceCostPerMonth + cloudCostPerMonth + egressCostPerMonth + totalLoanPayment

  const monthlyProfit = totalMRR - estimatedMRE

  const animatedBalance = useAnimatedNumber(balance)
  const animatedMRR = useAnimatedNumber(totalMRR)
  const animatedMRE = useAnimatedNumber(estimatedMRE)
  const animatedProfit = useAnimatedNumber(monthlyProfit)

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Financial Overview', icon: <DollarSign size={20} /> },
    { id: 'banking', label: 'Corporate Banking', icon: <Globe size={20} /> },
    { id: 'reputation', label: 'Enterprise Trust', icon: <Award size={20} /> },
    { id: 'marketplace', label: 'Contract Market', icon: <Briefcase size={20} /> },
    { id: 'active', label: 'Active Contracts', icon: <CheckCircle2 size={20} /> },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Finance & Logistics"
      icon={<BarChart3 size={32} />}
      width="lg"
      className="max-w-6xl !bg-slate-950 border-slate-800"
      headerExtra={
        <div className="flex items-center gap-4 mt-1 mr-4">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <Globe className="w-3 h-3" /> Site: Primary-DC
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <Award className="w-3 h-3 text-amber-400" /> Rep: {reputation}
          </div>
        </div>
      }
    >
      <div className="flex flex-1 overflow-hidden h-[75vh]">
        {/* Sidebar Tabs */}
        <div className="w-64 border-r border-slate-800 p-6 flex flex-col gap-2 bg-slate-900/10">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as typeof activeTab)}
            variant="sidebar"
          />
                
                <div className="mt-auto pt-6 border-t border-slate-800">
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Current Balance</p>
                    <p className="text-2xl font-black text-emerald-400">${Math.floor(animatedBalance).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 overflow-y-auto p-10 bg-slate-950/50 custom-scrollbar">
                {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-3 gap-6">
                      <MetricCard label="Monthly Revenue (MRR)" value={`$${Math.floor(animatedMRR).toLocaleString()}`} trend={totalMRR > 0 ? 'up' : 'neutral'} icon={TrendingUp} color="text-emerald-400" />
                      <MetricCard label="Operating Expenses (MRE)" value={`$${Math.floor(animatedMRE).toLocaleString()}`} trend="down" icon={TrendingDown} color="text-rose-400" />
                      <MetricCard label="Net Monthly Profit" value={`$${Math.floor(animatedProfit).toLocaleString()}`} trend={monthlyProfit >= 0 ? 'up' : 'down'} icon={BarChart3} color={monthlyProfit >= 0 ? 'text-teal-400' : 'text-rose-400'} />
                    </div>

                    <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6">Financial Statement</h3>
                      <div className="space-y-4">
                        <ExpenseItem label="Energy & Power Usage" amount={-powerCostPerMonth} sub={`${totalPowerKW.toFixed(2)} KW Average Load`} />
                        <ExpenseItem label="Colocation Rack Rental" amount={-rackRentPerMonth} sub={`${rackCount} Active Racks`} />
                        <ExpenseItem 
                          label="Hardware Maintenance & Stress" 
                          amount={-maintenanceCostPerMonth} 
                          sub={`${throttledNodeCount} Nodes Throttled`} 
                        />
                        <div className="h-px bg-slate-800 my-4" />
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Hybrid Cloud Metrics</p>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${cloudBurstingActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
                            <span className="text-xs font-bold text-white uppercase">Cloud Bursting</span>
                          </div>
                          <button 
                            onClick={() => useInfraStore.getState().setCloudBursting(!cloudBurstingActive)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${cloudBurstingActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                          >
                            {cloudBurstingActive ? 'ACTIVE' : 'ACTIVATE'}
                          </button>
                        </div>
                        <ExpenseItem label="Cloud Instance Payout" amount={-cloudCostPerMonth} sub={`${activeCloudInstances} Virtual Instances`} />
                        <ExpenseItem label="Network Egress Fees" amount={-egressCostPerMonth} sub={`${cloudEgressGB.toFixed(1)} GB Transferred/s`} />
                        <div className="h-px bg-slate-800 my-4" />
                        <ExpenseItem label="Contract Revenue" amount={totalMRR} sub={`${activeContracts.length} Service Level Agreements`} />
                        <div className="h-px bg-slate-800 my-4" />
                        <ExpenseItem label="Debt Servicing" amount={-totalLoanPayment} sub={`${loans.length} Active Loans`} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'reputation' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{getReputationTier(reputation)}</h3>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Enterprise Trust Tier</p>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-teal-400">{reputation}<span className="text-sm text-slate-500">/100</span></div>
                        <p className="text-[10px] text-slate-500 font-black uppercase mt-2">Reputation Score</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
                      <h4 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-6">Reputation History Log</h4>
                      {reputationHistory.length === 0 ? (
                        <p className="text-slate-600 text-sm italic">No recent events logged.</p>
                      ) : (
                        <div className="space-y-3">
                          {reputationHistory.map((entry: any) => (
                            <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800/50">
                              <div className="flex items-center gap-4">
                                <div className={`w-2 h-2 rounded-full ${entry.amount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="text-xs font-bold text-slate-300 uppercase">{entry.reason}</span>
                              </div>
                              <div className="flex items-center gap-6">
                                <span className="text-[10px] text-slate-600 font-bold">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                <span className={`text-sm font-black ${entry.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {entry.amount > 0 ? '+' : ''}{entry.amount}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'marketplace' && (
                  <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    {marketContracts.map((bp: any) => (
                      <ContractCard 
                        key={bp.id} 
                        bp={bp} 
                        isLocked={reputation < bp.minReputation || (bp.minLevel ? companyLevel < bp.minLevel : false)}
                        isOwned={activeContracts.some((c: any) => c.blueprintId === bp.id)}
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
                      activeContracts.map((c: any) => {
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
                {activeTab === 'banking' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-black uppercase text-slate-500 tracking-widest">Available Loans</h4>
                          <span className="text-[10px] font-bold text-teal-400 bg-teal-400/10 px-2 py-1 rounded">Interest Modifier: {(reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5)}x</span>
                        </div>
                        <div className="space-y-4">
                          <LoanOfferCard 
                            name="Startup Seed Capital" 
                            principal={50000} 
                            interestRate={0.03 * (reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5)} 
                            minimumMonthlyPayment={2000} 
                            onTake={() => takeLoan("Startup Seed Capital", 50000, 0.03 * (reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5), 2000)}
                            isLocked={companyLevel > 3}
                            lockReason="Only available for early-stage startups (Level 1-3)."
                          />
                          <LoanOfferCard 
                            name="Facility Expansion Loan" 
                            principal={250000} 
                            interestRate={0.05 * (reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5)} 
                            minimumMonthlyPayment={15000} 
                            onTake={() => takeLoan("Facility Expansion Loan", 250000, 0.05 * (reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5), 15000)}
                            isLocked={companyLevel < 2}
                            lockReason="Requires Enterprise Level 2."
                          />
                          <LoanOfferCard 
                            name="Hyperscaler Mega-Debt" 
                            principal={1000000} 
                            interestRate={0.08 * (reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5)} 
                            minimumMonthlyPayment={85000} 
                            onTake={() => takeLoan("Hyperscaler Mega-Debt", 1000000, 0.08 * (reputation > 80 ? 0.5 : reputation > 60 ? 0.75 : reputation > 40 ? 1.0 : 1.5), 85000)}
                            isLocked={companyLevel < 4}
                            lockReason="Requires Enterprise Level 4."
                          />
                        </div>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
                        <h4 className="text-sm font-black uppercase text-slate-500 tracking-widest mb-4">Active Debt</h4>
                        {loans.length === 0 ? (
                          <div className="h-32 flex items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-2xl">
                            <p className="font-black uppercase tracking-widest text-xs">No active corporate debt</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {loans.map((loan: any) => (
                              <div key={loan.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-white font-bold tracking-tight">{loan.name}</span>
                                  <span className="text-rose-400 font-black">${loan.remainingAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-500 font-black uppercase mb-4">
                                  <span>Int: {(loan.interestRate * 100).toFixed(1)}%/mo</span>
                                  <span>Min: ${loan.minimumMonthlyPayment.toLocaleString()}/mo</span>
                                </div>
                                <button 
                                  onClick={() => repayLoan(loan.id, Math.min(balance, loan.remainingAmount, 10000))}
                                  disabled={balance <= 0}
                                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
                                >
                                  Pay Down $10k
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
      </div>
    </Modal>
  )
}


interface MetricCardProps {
  label: string
  value: string
  trend: 'up' | 'down' | 'neutral'
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}

function MetricCard({ label, value, trend, icon: Icon, color }: MetricCardProps) {
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

interface ExpenseItemProps {
  label: string
  amount: number
  sub: string
}

function ExpenseItem({ label, amount, sub }: ExpenseItemProps) {
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
          <span className="text-[10px] font-black text-rose-400 uppercase">
            Requires {bp.minLevel && `Level ${bp.minLevel}`} {bp.minLevel && bp.minReputation ? '& ' : ''} {bp.minReputation ? `Rep ${bp.minReputation}` : ''}
          </span>
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

function LoanOfferCard({ name, principal, interestRate, onTake, isLocked, lockReason }: { name: string, principal: number, interestRate: number, minimumMonthlyPayment: number, onTake: () => void, isLocked: boolean, lockReason: string }) {
  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-2xl p-5 ${isLocked ? 'opacity-50 grayscale' : ''}`}>
      <h5 className="font-black text-white uppercase tracking-tight mb-2">{name}</h5>
      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase mb-4">
        <span>Principal: <span className="text-emerald-400 font-black">${principal.toLocaleString()}</span></span>
        <span>Int: {(interestRate * 100).toFixed(1)}%/mo</span>
      </div>
      {isLocked ? (
        <div className="w-full py-2 bg-slate-900 border border-slate-800 text-slate-500 rounded-lg text-xs font-black uppercase text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {lockReason}
        </div>
      ) : (
        <button 
          onClick={onTake}
          className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
        >
          Secure Capital
        </button>
      )}
    </div>
  )
}

