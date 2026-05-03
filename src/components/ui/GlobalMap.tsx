import { useMemo } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

function mercatorProject(lat: number, lng: number, width: number, height: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * width
  const latRad = (lat * Math.PI) / 180
  const y = (height / 2) - (width * Math.log(Math.tan((Math.PI / 4) + (latRad / 2))) / (2 * Math.PI))
  return { x, y }
}

export function GlobalMap() {
  const isOpen = useInfraStore(s => s.isGlobalMapOpen)
  const toggleGlobalMap = useInfraStore(s => s.toggleGlobalMap)
  const sites = useInfraStore(s => s.sites)
  const nodes = useInfraStore(s => s.nodes)
  const setCurrentSiteId = useInfraStore(s => s.setCurrentSiteId)

  const siteData = useMemo(() => {
    return sites.map((site: any) => {
      const siteHw = nodes.filter(n => n.siteId === site.id && n.type !== 'rack' && n.type !== 'cooling')
      const healthyCount = siteHw.filter(n => n.healthStatus === 'healthy' || !n.healthStatus).length
      const healthIndex = siteHw.length > 0 ? Math.round((healthyCount / siteHw.length) * 100) : 100
      
      const lat = site.geoCoords?.lat ?? 0
      const lng = site.geoCoords?.lng ?? 0
      const coords = mercatorProject(lat, lng, 960, 500)
      
      return { ...site, healthIndex, coords, nodeCount: siteHw.length }
    })
  }, [sites, nodes])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[60] bg-[#020a1a]/95 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300"
      onClick={toggleGlobalMap}
    >
      <div className="relative w-full max-w-5xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              <span>🌍</span> Global Command Center
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time multi-region infrastructure topology</p>
          </div>
          <button 
            onClick={toggleGlobalMap}
            className="text-slate-400 hover:text-white transition-colors text-xl px-2"
          >✕</button>
        </div>

        {/* Map Container */}
        <div className="relative bg-[#050e24] border border-slate-700/50 rounded-xl overflow-hidden" style={{ height: '500px' }}>
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 960 500" preserveAspectRatio="none">
            {/* Latitude lines */}
            {[100, 150, 200, 250, 300, 350, 400].map(y => (
              <line key={`lat-${y}`} x1="0" y1={y} x2="960" y2={y} stroke="#1e3a5f" strokeWidth="0.5" strokeDasharray="4,8" />
            ))}
            {/* Longitude lines */}
            {[120, 240, 360, 480, 600, 720, 840].map(x => (
              <line key={`lng-${x}`} x1={x} y1="0" x2={x} y2="500" stroke="#1e3a5f" strokeWidth="0.5" strokeDasharray="4,8" />
            ))}
            
            {/* Simplified continent outlines */}
            <path d="M 130,80 L 150,85 170,100 180,120 200,140 220,150 230,170 225,190 210,200 190,210 170,200 150,190 130,195 110,190 100,180 95,160 100,140 110,120 120,100 130,80 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />
            <path d="M 200,250 L 220,240 240,250 250,270 260,300 265,330 260,360 250,380 235,390 220,385 210,370 205,340 200,310 195,280 200,250 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />
            <path d="M 440,80 L 460,75 480,80 500,90 510,100 515,115 510,130 500,140 485,145 470,140 455,130 445,115 440,100 440,80 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />
            <path d="M 450,160 L 470,155 490,160 510,175 520,200 525,230 520,260 510,290 500,310 485,325 470,330 455,325 445,310 440,280 438,250 440,220 445,190 450,160 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />
            <path d="M 520,70 L 560,65 600,70 650,80 700,95 740,110 770,130 790,150 800,170 790,190 770,200 740,195 700,185 660,170 620,160 580,150 550,140 530,125 520,105 520,70 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />
            <path d="M 640,170 L 660,165 675,175 680,195 675,215 665,230 650,235 640,225 635,205 635,185 640,170 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />
            <path d="M 750,310 L 780,300 810,310 830,330 835,350 825,370 800,380 775,375 755,360 745,340 750,310 Z" fill="#0d2240" stroke="#1e4976" strokeWidth="1" />

            {/* Inter-site connection lines */}
            {siteData.length >= 2 && siteData.map((site: any, i: number) => 
              siteData.slice(i + 1).map((other: any) => (
                <line 
                  key={`link-${site.id}-${other.id}`}
                  x1={site.coords.x} y1={site.coords.y}
                  x2={other.coords.x} y2={other.coords.y}
                  stroke="#c9a032" strokeWidth="1.5" strokeDasharray="6,4"
                  opacity="0.5"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
                </line>
              ))
            )}
          </svg>

          {/* Site Pings */}
          {siteData.map((site: any) => {
            const color = site.healthIndex > 80 ? '#22c55e' : site.healthIndex > 50 ? '#eab308' : '#ef4444'
            const pctX = (site.coords.x / 960) * 100
            const pctY = (site.coords.y / 500) * 100

            return (
              <div 
                key={site.id}
                className="absolute cursor-pointer group"
                style={{ left: `${pctX}%`, top: `${pctY}%`, transform: 'translate(-50%, -50%)' }}
                onClick={() => { setCurrentSiteId(site.id); toggleGlobalMap() }}
              >
                <div 
                  className="absolute w-12 h-12 rounded-full animate-ping opacity-30"
                  style={{ backgroundColor: color, top: '-12px', left: '-12px' }}
                />
                <div 
                  className="absolute w-8 h-8 rounded-full animate-pulse opacity-50"
                  style={{ backgroundColor: color, top: '-8px', left: '-8px', filter: `blur(4px)` }}
                />
                <div 
                  className="w-4 h-4 rounded-full border-2 border-white shadow-lg relative z-10"
                  style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}` }}
                />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-8 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0a1536]/95 border border-slate-600 rounded-lg px-3 py-2 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                  <p className="text-[11px] font-bold text-white">{site.name}</p>
                  <p className="text-[9px] text-slate-400">{site.region} • {site.nodeCount} nodes</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-mono" style={{ color }}>{site.healthIndex}% Health</span>
                  </div>
                  <p className="text-[8px] text-slate-500 mt-0.5">{site.energySource === 'Renewable' ? '🌿 Renewable' : '⚡ Grid Power'}</p>
                </div>
              </div>
            )
          })}

          {/* Legend */}
          <div className="absolute bottom-3 right-3 bg-[#0a1536]/90 border border-slate-700/50 rounded-lg px-3 py-2">
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-1">Legend</p>
            <div className="flex gap-3">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[9px] text-slate-400">Healthy</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-[9px] text-slate-400">Degraded</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[9px] text-slate-400">Critical</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#c9a032]" /><span className="text-[9px] text-slate-400">Undersea Fiber</span></div>
            </div>
          </div>

          {/* Region labels */}
          <div className="absolute top-3 left-3 bg-[#0a1536]/80 border border-slate-700/50 rounded px-2 py-1">
            <p className="text-[9px] text-slate-500">{sites.length} active regions • Click a site to navigate</p>
          </div>
        </div>
      </div>
    </div>
  )
}
