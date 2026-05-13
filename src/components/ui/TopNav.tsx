import { useInfraStore } from '../../store/useInfraStore'

interface TopNavProps {
  onOpenNetwork: () => void
  onToggleNOC: () => void
  onToggleTerminal: () => void
  onToggleEconomy: () => void
  onToggleGlobalMap: () => void
  onOpenHandbook: () => void
  onToggleSaveManager: () => void
  isTerminalOpen: boolean
}

export function TopNav({ 
  onOpenNetwork, 
  onToggleNOC,
  onToggleTerminal,
  onToggleEconomy,
  onToggleGlobalMap,
  onOpenHandbook,
  onToggleSaveManager,
  isTerminalOpen,
}: TopNavProps) {
  const isNetworkManagerOpen = useInfraStore(s => s.isNetworkManagerOpen)
  const cloudBurstingActive = useInfraStore(s => s.cloudBurstingActive)
  const activeCloudInstances = useInfraStore(s => s.activeCloudInstances)
  
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-16 bg-[#020617]/90 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      {/* Brand */}
      <div className="flex items-center gap-4 group cursor-default">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.3)] group-hover:shadow-[0_0_30px_rgba(45,212,191,0.5)] transition-all duration-500">
          <span className="text-xl font-black text-[#020617]">IT</span>
        </div>
        <div>
          <h1 className="text-sm font-black text-white tracking-tighter uppercase leading-none">SDDC <span className="text-teal-400">Orchestrator</span></h1>
          <p className="text-[9px] text-slate-500 font-bold tracking-[0.2em] uppercase mt-1">Enterprise Ops v2.0</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex items-center gap-2">
        {[
          { id: 'noc', label: 'NOC DASHBOARD', icon: '📡', active: false, onClick: onToggleNOC },
          { id: 'global_map', label: 'GLOBAL MAP', icon: '🌍', active: false, onClick: onToggleGlobalMap },
          { id: 'network', label: 'GLOBAL NETWORK', icon: '🌐', active: isNetworkManagerOpen, onClick: onOpenNetwork },
          { id: 'economy', label: 'FINANCIALS', icon: '💰', active: false, onClick: onToggleEconomy },
          { id: 'terminal', label: 'GLOBAL TERMINAL', icon: '⌨️', active: isTerminalOpen, onClick: onToggleTerminal },
          { id: 'handbook', label: 'HANDBOOK', icon: '📖', active: false, onClick: onOpenHandbook },
          { id: 'save', label: 'PERSISTENCE', icon: '💾', active: false, onClick: onToggleSaveManager },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={tab.onClick}
            aria-label={tab.label}
            className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-3 border ${tab.active ? 'bg-teal-500/10 border-teal-500 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* System Status & Performance */}
      <div className="flex items-center gap-8">
        <div className="h-8 w-px bg-white/10" />
        
        <div className="flex flex-col items-end">
          <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Uptime Cycle</p>
          <span className="text-xs font-black font-mono tracking-tighter text-teal-400">
            {useInfraStore.getState().simulationCycle}
          </span>
        </div>
      </div>
    </div>
  )
}
