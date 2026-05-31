import { useState, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { Button } from './base/Button'
import { Badge } from './base/Badge'

interface TopNavProps {
  onOpenNetwork: () => void
  onToggleNOC: () => void
  onToggleTerminal: () => void
  onToggleEconomy: () => void
  onToggleGlobalMap: () => void

  onToggleStorage: () => void
  onOpenHandbook: () => void
  onToggleSaveManager: () => void
  isTerminalOpen: boolean
  isStorageOpen: boolean
}

export function TopNav({ 
  onOpenNetwork, 
  onToggleNOC,
  onToggleTerminal,
  onToggleEconomy,
  onToggleGlobalMap,

  onToggleStorage,
  onOpenHandbook,
  onToggleSaveManager,
  isTerminalOpen,
  isStorageOpen,
}: TopNavProps) {
  const { 
    currentSiteId, 
    sites, 
    setCurrentSiteId, 
    isNetworkManagerOpen,
    timeFormat,
    setTimeFormat,
    companyLevel,
    experience,
    xpToNextLevel,
    realTimePlayedSeconds,
    toggleFacilityFeed,
    isAIDashboardOpen,
    toggleAIDashboard
  } = useInfraStore(useShallow(state => ({
    currentSiteId: state.currentSiteId, 
    sites: state.sites, 
    setCurrentSiteId: state.setCurrentSiteId, 
    realTimePlayedSeconds: state.realTimePlayedSeconds, 
    timeFormat: state.timeFormat,
    setTimeFormat: state.setTimeFormat,
    companyLevel: state.companyLevel,
    experience: state.experience,
    xpToNextLevel: state.xpToNextLevel,
    isNetworkManagerOpen: state.isNetworkManagerOpen,
    toggleFacilityFeed: state.toggleFacilityFeed,
    isAIDashboardOpen: state.isAIDashboardOpen,
    toggleAIDashboard: state.toggleAIDashboard
  })))
  const activeSite = sites.find(s => s.id === currentSiteId)
  const xpPercentage = Math.min(100, (experience / xpToNextLevel) * 100)
  
  const [utilityA, setUtilityA] = useState(true)
  const [utilityB, setUtilityB] = useState(true)

  const handleToggleFeed = (feed: 'A' | 'B', current: boolean) => {
    const next = !current
    if (feed === 'A') setUtilityA(next)
    if (feed === 'B') setUtilityB(next)
    toggleFacilityFeed(feed, next)
  }

  const [localTime, setLocalTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatLocalTime = (date: Date, format: '12h' | '24h') => {
    if (format === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    }
  }

  const formatUptime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    
    const pad = (num: number) => String(num).padStart(2, '0')
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`
    }
    return `${pad(m)}:${pad(s)}`
  }

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] h-[3.25rem] glass-panel rounded-[2rem] flex items-center justify-between px-5 gap-8 shadow-2xl">
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

        {/* Level & XP Bar */}
        <div className="hidden xl:flex flex-col gap-1.5 w-32">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Tier {companyLevel}</span>
            <span className="text-[8px] font-black text-teal-400 tracking-wider uppercase">{Math.floor(xpPercentage)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.5)] transition-all duration-1000"
              style={{ width: `${xpPercentage}%` }}
            />
          </div>
        </div>



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
      <nav className="flex items-center gap-2">
        {/* Operations Dropdown */}
        <div className="relative group">
          <Button
            variant="ghost"
            icon={<span className="text-base mr-1">⚙️</span>}
            className="text-[9px] font-black tracking-widest px-4 h-9 bg-white/5 border border-white/10 hover:bg-white/10"
          >
            OPERATIONS <span className="text-[8px] ml-2 opacity-50">▼</span>
          </Button>
          <div className="absolute top-full left-0 mt-2 w-48 bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden py-1">
            {[
              { id: 'noc', label: 'NOC', icon: '📡', onClick: onToggleNOC },
              { id: 'storage', label: 'STORAGE', icon: '🗄️', active: isStorageOpen, onClick: onToggleStorage },
              { id: 'ai', label: 'AI CLUSTER', icon: '🧠', active: isAIDashboardOpen, onClick: toggleAIDashboard },
              { id: 'network', label: 'NETWORK', icon: '🌐', active: isNetworkManagerOpen, onClick: onOpenNetwork },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={tab.onClick}
                className={`w-full text-left px-4 py-3 text-[10px] font-black tracking-widest flex items-center gap-3 transition-colors hover:bg-white/10 ${tab.active ? 'text-teal-400 bg-teal-500/10' : 'text-slate-300'}`}
              >
                <span className="text-sm">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Management Dropdown */}
        <div className="relative group">
          <Button
            variant="ghost"
            icon={<span className="text-base mr-1">💼</span>}
            className="text-[9px] font-black tracking-widest px-4 h-9 bg-white/5 border border-white/10 hover:bg-white/10"
          >
            MANAGEMENT <span className="text-[8px] ml-2 opacity-50">▼</span>
          </Button>
          <div className="absolute top-full left-0 mt-2 w-48 bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden py-1">
            {[
              { id: 'global_map', label: 'MAP', icon: '🌍', onClick: onToggleGlobalMap },
              { id: 'economy', label: 'FINANCE', icon: '💰', onClick: onToggleEconomy },
              { id: 'terminal', label: 'TERMINAL', icon: '⌨️', active: isTerminalOpen, onClick: onToggleTerminal },
              { id: 'handbook', label: 'DOCS', icon: '📖', onClick: onOpenHandbook },
              { id: 'save', label: 'SAVE', icon: '💾', onClick: onToggleSaveManager },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={tab.onClick}
                className={`w-full text-left px-4 py-3 text-[10px] font-black tracking-widest flex items-center gap-3 transition-colors hover:bg-white/10 ${tab.active ? 'text-teal-400 bg-teal-500/10' : 'text-slate-300'}`}
              >
                <span className="text-sm">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* System Status & Operations Clock */}
      <div className="flex items-center gap-6">
        
        {/* UTILITY POWER OUTAGE SIMULATION */}
        <div className="flex gap-2 p-1.5 bg-slate-900/50 rounded-xl border border-slate-800">
          <Button 
            variant={utilityA ? 'primary' : 'danger'} 
            onClick={() => handleToggleFeed('A', utilityA)}
            className="py-1 px-3 text-[9px]"
          >
            GRID A {utilityA ? 'ON' : 'OFF'}
          </Button>
          <Button 
            variant={utilityB ? 'primary' : 'danger'} 
            onClick={() => handleToggleFeed('B', utilityB)}
            className="py-1 px-3 text-[9px]"
          >
            GRID B {utilityB ? 'ON' : 'OFF'}
          </Button>
        </div>

        {/* Local Clock */}
        <div 
          onClick={() => setTimeFormat(timeFormat === '24h' ? '12h' : '24h')}
          className="flex flex-col items-end cursor-pointer group select-none px-3 py-1 bg-white/5 border border-white/10 rounded-lg hover:border-teal-500/50 hover:bg-teal-950/20 transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.02)] hover:shadow-[0_0_15px_rgba(45,212,191,0.1)]"
          title="Click to toggle 12-hour / 24-hour local clock format"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest group-hover:text-teal-400 transition-colors">Local Time</p>
          </div>
          <span className="text-xs font-black font-mono tracking-tight text-teal-400 mt-0.5 group-hover:scale-105 transition-transform">
            {formatLocalTime(localTime, timeFormat)}
          </span>
        </div>

        {/* System Uptime indicator */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <Badge variant="success" glow className="py-0">ONLINE</Badge>
            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Uptime</p>
          </div>
          <span className="text-xs font-black font-mono tracking-tighter text-teal-400 mt-0.5">
            {formatUptime(realTimePlayedSeconds)}
          </span>
        </div>
      </div>
    </div>
  )
}
