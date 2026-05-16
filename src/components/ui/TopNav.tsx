import { useInfraStore } from '../../store/useInfraStore'
import { Button } from './base/Button'
import { Badge } from './base/Badge'

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
  const { currentSiteId, sites, setCurrentSiteId, simulationCycle, isNetworkManagerOpen } = useInfraStore()
  const activeSite = sites.find(s => s.id === currentSiteId)

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-16 glass-dark border-b border-white/10 flex items-center justify-between px-8">
      {/* Brand & Site Selector */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 group cursor-default">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.3)] group-hover:shadow-[0_0_30px_rgba(45,212,191,0.5)] transition-all duration-500">
            <span className="text-xl font-black text-[#020617]">IT</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-sm font-black text-white tracking-tighter uppercase leading-none">SDDC <span className="text-teal-400">Orchestrator</span></h1>
            <p className="text-[9px] text-slate-500 font-bold tracking-[0.2em] uppercase mt-1">Enterprise Ops v2.0</p>
          </div>
        </div>

        <div className="h-8 w-px bg-white/10 mx-2" />

        {/* Site Selector Dropdown Style */}
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Site:</span>
          <select 
            value={currentSiteId}
            onChange={(e) => setCurrentSiteId(e.target.value)}
            className="bg-transparent text-teal-400 text-[11px] font-black uppercase tracking-tight focus:outline-none cursor-pointer"
          >
            {sites.map(site => (
              <option key={site.id} value={site.id} className="bg-slate-900 text-white">
                {site.name} ({site.region})
              </option>
            ))}
          </select>
          {activeSite?.isDisaster && <Badge variant="error" glow className="ml-1 animate-pulse">DR</Badge>}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex items-center gap-1">
        {[
          { id: 'noc', label: 'NOC', icon: '📡', onClick: onToggleNOC },
          { id: 'global_map', label: 'MAP', icon: '🌍', onClick: onToggleGlobalMap },
          { id: 'network', label: 'NETWORK', icon: '🌐', active: isNetworkManagerOpen, onClick: onOpenNetwork },
          { id: 'economy', label: 'FINANCE', icon: '💰', onClick: onToggleEconomy },
          { id: 'terminal', label: 'TERMINAL', icon: '⌨️', active: isTerminalOpen, onClick: onToggleTerminal },
          { id: 'handbook', label: 'DOCS', icon: '📖', onClick: onOpenHandbook },
          { id: 'save', label: 'SAVE', icon: '💾', onClick: onToggleSaveManager },
        ].map(tab => (
          <Button
            key={tab.id}
            variant={tab.active ? 'primary' : 'ghost'}
            onClick={tab.onClick}
            icon={<span className="text-base mr-1">{tab.icon}</span>}
            className="text-[9px] font-black tracking-widest px-4 h-9"
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      {/* System Status */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <Badge variant="success" glow className="py-0">ONLINE</Badge>
            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Cycle</p>
          </div>
          <span className="text-xs font-black font-mono tracking-tighter text-teal-400 mt-0.5">
            {simulationCycle.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
