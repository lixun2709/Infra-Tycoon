import { useMemo, useState, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { Activity, Shield, Globe, Database, Server } from 'lucide-react'

const MAP_BITS = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000001011111110111111111111111110000000000000000000000000000000000001000000000000000000000000000|000000000000000000000001000000001110111111111111111111000000000001100000000000000000000000000000000000000000000000000000|000000000000000000000001100110111100000001111111111111000000000000000000000000011000000001111111110000000011111000000000|000000000000000000010111010100111111000000111111111110000000000000000000000000100001111011111111111111100001110000000000|000000111111111111111001100011001001110000011111111100000000000000111111100000000101111111111111111111111111111111111111|111101111111111111111111111111110000111100011111000000110000000001111111001111111111111111111111111111111111111111111111|000000111111111111111111111111000000011000001100000000000000000111101111111111111111111111111111111111111111111111111111|000000111110011111111111111110000001100000000000000000000000001111101011111111111111111111111111111111111111111100110000|000000000000000011111111111111100001111100000000000000000011000101001111111111111111111111111111111111111110000001100000|000000000000000011111111111111111011111110000000000000000100000111111111111111111111111111111111111111111100000011000000|000000000000000000111111111111111111111111000000000000000001111111111111111111111111111111111111111111111110000000000000|000000000000000000001111111111111111111001100000000000000001111111111111111111111111111111111111111111111110000000000000|000000000000000000011111111111111111110100000000000000000000111111111100011100111111111111111111111111111100000000000000|000000000000000000011111111111111111100000000000000000000111110111011100001110111111111111111111111111110001000000000000|000000000000000000011111111111111110000000000000000000000111000000010111111110111111111111111111111100100001000000000000|000000000000000000001111111111111110000000000000000000000000011100000000011111111111111111111111111110010010000000000000|000000000000000000000111111111111100000000000000000000000011111100000000111111111111111111111111111110000000000000000000|000000000000000000000001111111100000000000000000000000000111111111111111111111111111111111111111111110000000000000000000|000000000000000000000010111100000100000000000000000000001111111111111111111110111111111111111111111110000000000000000000|000000000000000000000000011100000000000000000000000000011111111111111111011111110001111111111111111100000000000000000000|000000000000000000000000011100110010000000000000000000011111111111111111101111110000011111011111000000000000000000000000|000000000000000000000000001111100000001000000000000000011111111111111111101111100000011100001111000000000000000000000000|000000000000000000000000000000111000000000000000000000011111111111111111110110000000011000000111100000000000000000000000|000000000000000000000000000000001000100000000000000000011111111111111111111001000000001000000101100000000000000000000000|000000000000000000000000000000000011111100000000000000001111111111111111111110000000001100000101000000100000000000000000|000000000000000000000000000000000001111110000000000000000111101111111111111111000000000000000001000010000000000000000000|000000000000000000000000000000000001111111110000000000000000000011111111111100000000000000000110001100000000000000000000|000000000000000000000000000000000011111111110000000000000000000011111111111000000000000000000010011110000000000000000000|000000000000000000000000000000000011111111111110000000000000000011111111110000000000000000000011011010010011000000000000|000000000000000000000000000000000111111111111111100000000000000001111111100000000000000000000000000000000001111000000000|000000000000000000000000000000000011111111111111110000000000000000111111111000000000000000000000000100100001010000000000|000000000000000000000000000000000001111111111111000000000000000001111111110000000000000000000000000000000000000000000000|000000000000000000000000000000000001111111111111000000000000000001111111110010000000000000000000000000111100100000000000|000000000000000000000000000000000000011111111110000000000000000011111111100110000000000000000000000001111111100000000000|000000000000000000000000000000000000011111111110000000000000000001111111000110000000000000000000000111111111110000010000|000000000000000000000000000000000000011111111000000000000000000001111111000100000000000000000000001111111111111000000000|000000000000000000000000000000000000011111110000000000000000000000111110000000000000000000000000001111111111111100000000|000000000000000000000000000000000000011111110000000000000000000000111110000000000000000000000000000111111111111100000000|000000000000000000000000000000000000011111100000000000000000000000011100000000000000000000000000000111000111111000000000|000000000000000000000000000000000000111110000000000000000000000000000000000000000000000000000000000000000001111000000010|000000000000000000000000000000000000111100000000000000000000000000000000000000000000000000000000000000000000000000000001|000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000010000000010|000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000001100|000000000000000000000000000000000001111000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000001100000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000|000000000000000000000000000000000000000100000000000000000000000000000000000000100000000000000000001000000100000000000000|000000000000000000000000000000000000001000000000000000000000000000000000001111111111000111111111111111111111111100000000|0000000000000000000000000011000000001111000000000000000001111111111111111111111111111110111111111111111111111111111111111111100|000000000000001111111111010111111111111000000000000000011111111111111111111111111111111111111111111111111111111111110000|000000001111111111111111111111111111000000000000011111111111111111111111111111111111111111111111111111111111111111100000|000000000001111111111111111111111111100000010000011111111111111111111111111111111111111111111111111111111111111111000000|000100000011111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111100|000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

function projectCoords(lat: number, lng: number, width: number, height: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * width
  const y = ((90 - lat) / 180) * height
  return { x, y }
}

export function GlobalMap() {
  const isOpen = useInfraStore(s => s.isGlobalMapOpen)
  const toggleGlobalMap = useInfraStore(s => s.toggleGlobalMap)
  const sites = useInfraStore(s => s.sites)
  const nodes = useInfraStore(s => s.nodes)
  const setCurrentSiteId = useInfraStore(s => s.setCurrentSiteId)
  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  const [eventLogs, setEventLogs] = useState<{ id: string, msg: string, time: string, type: 'info' | 'warn' | 'success' }[]>([])

  useEffect(() => {
    if (!isOpen) return
    
    const logs = [
      { id: '1', msg: 'NEURAL FABRIC INITIALIZED', time: '0.00ms', type: 'info' },
      { id: '2', msg: 'CROSS-REGION TUNNELS ENCRYPTED', time: '12.4ms', type: 'success' },
      { id: '3', msg: 'LATENCY OPTIMIZATION ACTIVE', time: '42.1ms', type: 'info' },
    ] as const
    setEventLogs([...logs])
    
    const interval = setInterval(() => {
      const events = ['SYNCING DATA...', 'LATENCY SPIKE DETECTED', 'OPTIMIZING PATHS', 'HEARTBEAT NOMINAL', 'SECURITY SCAN COMPLETE']
      const types = ['info', 'warn', 'info', 'success', 'info'] as const
      const idx = Math.floor(Math.random() * events.length)
      setEventLogs(prev => [{ 
        id: Math.random().toString(), 
        msg: events[idx], 
        time: `${(Math.random() * 50).toFixed(1)}ms`,
        type: types[idx] 
      }, ...prev].slice(0, 8))
    }, 4000)
    return () => clearInterval(interval)
  }, [isOpen])

  const siteData = useMemo(() => {
    return sites.map((site: any) => {
      const siteHw = nodes.filter(n => n.siteId === site.id && n.type !== 'rack' && n.type !== 'cooling')
      const healthyCount = siteHw.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
      const healthIndex = siteHw.length > 0 ? Math.round((healthyCount / siteHw.length) * 100) : 100
      
      const lat = site.geoCoords?.lat ?? 0
      const lng = site.geoCoords?.lng ?? 0
      const coords = projectCoords(lat, lng, 960, 500)
      
      return { ...site, healthIndex, coords, nodeCount: siteHw.length, hardware: siteHw }
    })
  }, [sites, nodes])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[60] bg-[#01040a]/95 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-700 overflow-hidden"
      onClick={toggleGlobalMap}
    >
      {/* Background Animated Grid (Darker) */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #2dd4bf 1px, transparent 0)', backgroundSize: '60px 60px' }} 
      />

      <div className="relative w-full max-w-[1500px] h-[850px] max-h-[90vh] flex gap-8 p-8" onClick={e => e.stopPropagation()}>
        
        {/* LEFT SIDEBAR */}
        <div className="w-80 flex flex-col gap-6 h-full">
          <div className="flex-shrink-0 glass-dark rounded-[2.5rem] p-8 transition-all hover:border-teal-500/30">
            <h3 className="text-[10px] font-black text-teal-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Global Pulse
            </h3>
            <div className="space-y-6">
              <div className="p-5 glass-teal rounded-3xl border border-white/5 transition-all group hover:bg-teal-500/10">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Aggregate Load</span>
                  <span className="text-sm font-black text-white">42.8%</span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div className="h-full bg-teal-500 rounded-full neo-glow-teal shadow-[0_0_15px_#2dd4bf]" style={{ width: '42.8%' }} />
                </div>
              </div>
              <div className="p-5 bg-orange-500/5 rounded-3xl border border-orange-500/10 transition-all group hover:bg-orange-500/10">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cloud Bursting</span>
                  <span className="text-sm font-black text-orange-500">ACTIVE</span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div className="h-full bg-orange-500 rounded-full neo-glow-orange shadow-[0_0_15px_#f97316]" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 glass-dark rounded-[2.5rem] p-8 flex flex-col overflow-hidden transition-all hover:border-teal-500/20">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Security Log
            </h3>
            <div className="flex-1 space-y-4 overflow-y-auto pr-3 custom-scrollbar">
              {eventLogs.map(log => (
                <div key={log.id} className="flex flex-col gap-2 border-l-2 border-slate-800 pl-5 py-2 hover:border-teal-500/50 transition-all group">
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors group-hover:text-white ${log.type === 'warn' ? 'text-orange-500' : log.type === 'success' ? 'text-teal-400' : 'text-slate-400'}`}>
                      {log.msg}
                    </span>
                    <span className="text-[8px] font-mono text-slate-700">{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER MAP */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex justify-between items-end px-6">
            <div>
              <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
                <Globe className="w-10 h-10 text-teal-400" /> GLOBAL COMMAND
              </h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-2">Neural Fabric v4.02 // Autonomous Site Orchestration</p>
            </div>
            <button 
              onClick={toggleGlobalMap}
              className="w-14 h-14 glass-dark rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all group shadow-2xl"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">✕</span>
            </button>
          </div>

          <div className="relative flex-1 bg-[#010409] border border-teal-500/30 rounded-[4rem] overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.9),0_0_80px_rgba(45,212,191,0.05)] group/map">
            
            <div className="absolute inset-0 pointer-events-none z-10 opacity-20">
              <div className="w-4 h-full bg-gradient-to-r from-transparent via-teal-400 to-transparent absolute top-0 left-0 animate-scan-horizontal" />
            </div>

            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 60" preserveAspectRatio="none">
              <defs>
                <filter id="glow-heavy">
                  <feGaussianBlur stdDeviation="0.8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <g fill="#0ea5e9" opacity="0.3">
                {MAP_BITS.split('|').map((row, y) => 
                  row.split('').map((cell, x) => 
                    cell === '1' ? <circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r="0.18" className="transition-all hover:fill-teal-400 hover:opacity-100" /> : null
                  )
                )}
              </g>
              
              {siteData.map((site: any, i: number) => 
                siteData.slice(i + 1).map((other: any) => {
                  const sX = (site.coords.x / 960) * 120
                  const sY = (site.coords.y / 500) * 60
                  const oX = (other.coords.x / 960) * 120
                  const oY = (other.coords.y / 500) * 60
                  const pathId = `path-${site.id}-${other.id}`
                  const pathD = `M ${sX} ${sY} Q ${(sX + oX)/2} ${(sY + oY)/2 - 12} ${oX} ${oY}`

                  return (
                    <g key={`link-group-${site.id}-${other.id}`}>
                      <path 
                        id={pathId}
                        d={pathD}
                        fill="none"
                        stroke={selectedSite === site.id || selectedSite === other.id ? "#2dd4bf" : "#0ea5e9"} 
                        strokeWidth={selectedSite === site.id || selectedSite === other.id ? "0.6" : "0.1"} 
                        className="transition-all duration-700 opacity-40"
                      />
                      {[0, 1].map(p => (
                        <circle key={`packet-${p}`} r="0.4" fill="#2dd4bf" filter="url(#glow-heavy)">
                          <animateMotion dur={`${1.5 + p}s`} repeatCount="indefinite" rotate="auto">
                            <mpath href={`#${pathId}`} />
                          </animateMotion>
                        </circle>
                      ))}
                    </g>
                  )
                })
              )}
            </svg>

            {siteData.map((site: any) => {
              const color = site.healthIndex > 80 ? '#2dd4bf' : site.healthIndex > 50 ? '#f59e0b' : '#ef4444'
              const pctX = (site.coords.x / 960) * 100
              const pctY = (site.coords.y / 500) * 100
              const isSelected = selectedSite === site.id

              return (
                <div 
                  key={site.id}
                  className="absolute cursor-pointer transition-all duration-700"
                  style={{ left: `${pctX}%`, top: `${pctY}%`, transform: 'translate(-50%, -50%)' }}
                  onClick={() => { setSelectedSite(site.id === selectedSite ? null : site.id) }}
                >
                  <div className="relative group/site">
                    <div className="absolute -inset-16 bg-teal-500/10 rounded-full blur-3xl opacity-0 group-hover/site:opacity-100 transition-opacity" />
                    <div className="absolute -inset-6 bg-white/20 rounded-full animate-ping opacity-10" />
                    
                    <div 
                      className={`w-10 h-10 rounded-full border-4 border-[#010409] shadow-2xl relative z-10 transition-all ${isSelected ? 'scale-150 neo-glow-teal' : 'scale-100'}`} 
                      style={{ backgroundColor: color }} 
                    />
                    
                    <div className={`absolute left-16 top-1/2 -translate-y-1/2 glass-dark rounded-[2rem] p-6 transition-all whitespace-nowrap z-30 min-w-[240px] ${isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8 pointer-events-none group-hover/site:opacity-100 group-hover/site:translate-x-0'}`}>
                       <div className="flex items-center gap-4">
                         <div className="w-12 h-12 glass-teal rounded-2xl flex items-center justify-center neo-glow-teal">
                            <Server className="w-6 h-6 text-teal-400" />
                         </div>
                         <div>
                           <p className="text-sm font-black text-white uppercase tracking-tighter">{site.name}</p>
                           <p className="text-[10px] text-teal-500/70 font-bold uppercase tracking-widest">{site.region}</p>
                         </div>
                       </div>
                       <div className="mt-6 grid grid-cols-2 gap-6">
                         <div>
                            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Health Index</p>
                            <p className="text-lg font-black" style={{ color }}>{site.healthIndex}%</p>
                         </div>
                         <div>
                            <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Engaged Nodes</p>
                            <p className="text-lg font-black text-white">{site.nodeCount}</p>
                         </div>
                       </div>
                       <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentSiteId(site.id); toggleGlobalMap() }}
                        className="mt-6 w-full py-4 bg-teal-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all shadow-xl hover:scale-[1.02] active:scale-95"
                       >
                         ENGAGE SECTOR
                       </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-80 flex flex-col gap-6 h-full">
           <div className="flex-1 min-h-0 glass-dark rounded-[2.5rem] p-8 flex flex-col transition-all hover:border-teal-500/20">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                <Database className="w-4 h-4" /> Site Inventory
              </h3>
              <div className="space-y-4 overflow-y-auto pr-3 custom-scrollbar">
                {siteData.map(site => (
                  <div key={site.id} className={`p-6 rounded-[2rem] border transition-all cursor-pointer ${selectedSite === site.id ? 'bg-teal-500/10 border-teal-500/40 shadow-2xl' : 'bg-white/2 border-white/5 hover:bg-white/5'}`} onClick={() => setSelectedSite(site.id)}>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-black text-white uppercase tracking-tight">{site.name}</span>
                      <div className={`w-2 h-2 rounded-full neo-glow-teal ${site.healthIndex > 80 ? 'bg-teal-400' : 'bg-orange-500'}`} />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-black/40 rounded-xl p-3 border border-white/5">
                        <p className="text-[8px] text-slate-600 font-bold uppercase mb-1">CPUs</p>
                        <p className="text-xs font-black text-white">{site.nodeCount * 32}</p>
                      </div>
                      <div className="flex-1 bg-black/40 rounded-xl p-3 border border-white/5">
                        <p className="text-[8px] text-slate-600 font-bold uppercase mb-1">RAM</p>
                        <p className="text-xs font-black text-white">{Math.floor(site.nodeCount * 0.4)} TB</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="glass-dark rounded-[2.5rem] p-8 transition-all hover:border-teal-500/20">
             <div className="flex justify-between items-center mb-6">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Stability</p>
                <span className="text-[10px] font-mono text-teal-400 neo-glow-teal">99.98%</span>
             </div>
             <div className="flex gap-2.5 h-12 items-end">
               {[40, 65, 35, 90, 45, 60, 30, 75, 55, 80, 45, 70].map((h, i) => (
                 <div key={i} className="flex-1 bg-teal-500/10 rounded-t-lg relative group overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-teal-500/40 transition-all duration-1000 group-hover:bg-teal-400" style={{ height: `${h}%` }} />
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}
