/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, useEffect, useRef } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { useUIStore } from '../../store/useUIStore'
import { Globe, Server, Plus, X, Cpu, HardDrive, Activity, Shield, Zap, Crosshair, Navigation } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Site } from '../../store/infraTypes'
import { EXPANSION_REGIONS } from '../../store/infraInitialState'

function MemoryIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect>
      <line x1="6" y1="7" x2="6" y2="17"></line>
      <line x1="10" y1="7" x2="10" y2="17"></line>
      <line x1="14" y1="7" x2="14" y2="17"></line>
      <line x1="18" y1="7" x2="18" y2="17"></line>
    </svg>
  )
}

function projectCoords(lat: number, lng: number): { x: number; y: number } {
  const rawX = (lng + 180) / 360;
  const rawY = (90 - lat) / 180;
  const x = (rawX * 100) * 1.02 - 1.5;
  const y = (rawY * 100) * 1.15 - 12;
  return { x, y }
}

function reverseProjectCoords(xPercent: number, yPercent: number) {
  const rawX = ((xPercent + 1.5) / 1.02) / 100;
  const lng = rawX * 360 - 180;
  const rawY = ((yPercent + 12) / 1.15) / 100;
  const lat = 90 - rawY * 180;
  return { lat, lng }
}

export function GlobalMap() {
  const isOpen = useUIStore(s => s.isGlobalMapOpen)
  const toggleGlobalMap = useUIStore(s => s.toggleGlobalMap)
  const sites = useInfraStore(s => s.sites)
  const nodesCount = useInfraStore(s => s.nodes.length)
  const setCurrentSiteId = useInfraStore(s => s.setCurrentSiteId)
  const purchaseSite = useInfraStore(s => s.purchaseSite)
  
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())

  // Pan and Zoom state
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [cursorCoords, setCursorCoords] = useState({ lat: 0, lng: 0 })
  const [isHoveringMap, setIsHoveringMap] = useState(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault() // prevent scrolling
    const scaleChange = e.deltaY * -0.002
    setScale(prev => Math.min(Math.max(1, prev + scaleChange), 8))
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mapContainerRef.current) return
    const rect = mapContainerRef.current.getBoundingClientRect()
    // Calculate relative percentage within the map container
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100
    const { lat, lng } = reverseProjectCoords(xPercent, yPercent)
    setCursorCoords({ lat, lng })
  }

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setScale(1), 0) // reset scale on close
      return
    }
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [isOpen])

  const siteData = useMemo(() => {
    if (nodesCount < 0) return []
    const nodes = useInfraStore.getState().nodes
    return sites.map((site: Site) => {
      const siteHw = nodes.filter((n: any) => n.siteId === site.id && n.type !== 'rack' && n.type !== 'cooling')
      const healthyCount = siteHw.filter((n: any) => n.healthStatus === 'healthy' || !n.healthStatus).length
      const healthIndex = siteHw.length > 0 ? Math.round((healthyCount / siteHw.length) * 100) : 100
      const coords = projectCoords(site.geoCoords?.lat ?? 0, site.geoCoords?.lng ?? 0)
      return { ...site, healthIndex, coords, nodeCount: siteHw.length, hardware: siteHw }
    })
  }, [sites, nodesCount])

  const unclaimedRegions = useMemo(() => {
    return EXPANSION_REGIONS.filter(er => !sites.some((s: any) => s.region === er.region)).map(er => ({
      ...er,
      type: er.type || 'edge',
      coords: projectCoords(er.geoCoords.lat, er.geoCoords.lng)
    }))
  }, [sites])

  if (!isOpen) return null

  const selectedSite = siteData.find((s: any) => s.id === selectedSiteId)
  const selectedRegion = unclaimedRegions.find(r => r.region === selectedRegionId)

  // Graticule Lines (Lat/Lng Grid)
  const latLines = Array.from({ length: 11 }, (_, i) => 90 - (i * 18)) // Every 18 degrees
  const lngLines = Array.from({ length: 13 }, (_, i) => -180 + (i * 30)) // Every 30 degrees

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-6 font-sans"
        onClick={toggleGlobalMap}
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[1400px] h-[85vh] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Navbar */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/50 relative z-50">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest">NOC Global View</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-emerald-400/80 uppercase tracking-widest font-mono">Uplink Active</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6 mr-4 border-r border-slate-800 pr-6">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest">Zoom Level</span>
                  <span className="text-xs text-blue-400 font-mono font-medium">{scale.toFixed(1)}x</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest">UTC Time</span>
                  <span className="text-xs text-slate-300 font-mono font-medium">{time.toISOString().substring(11, 19)}</span>
                </div>
              </div>
              <button 
                onClick={toggleGlobalMap}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 border border-transparent transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Interface */}
          <div className="flex flex-1 min-h-0 relative bg-[#020617] overflow-hidden">
            
            {/* Left Panel - Telemetry */}
            <div className="w-72 border-r border-slate-800/50 bg-slate-900/40 flex flex-col z-40 overflow-y-auto custom-scrollbar backdrop-blur-md">
              <div className="p-6 flex flex-col gap-6">
                {/* Global Status */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Activity className="w-3 h-3 text-blue-400" /> Network Status
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-slate-200">{siteData.length}</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Active Sites</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-blue-400">{siteData.reduce((acc: any, s: any) => acc + s.nodeCount, 0)}</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Online Nodes</span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Core Metrics</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1.5"><Cpu className="w-3 h-3 text-slate-500"/> Global Compute</span>
                        <span className="text-xs font-bold text-slate-200">{siteData.reduce((acc: any, s: any) => acc + s.nodeCount * 32, 0)} vCPU</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '45%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1.5"><Activity className="w-3 h-3 text-slate-500"/> Total Throughput</span>
                        <span className="text-xs font-bold text-slate-200">1.2 Tbps</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '68%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1.5"><Shield className="w-3 h-3 text-slate-500"/> Threat Level</span>
                        <span className="text-xs font-bold text-emerald-400">Minimal</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '15%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Map Area (Pannable & Zoomable) */}
            <div 
              className="flex-1 relative overflow-hidden bg-[#020617] cursor-grab active:cursor-grabbing select-none" 
              onClick={() => { setSelectedSiteId(null); setSelectedRegionId(null) }}
              onWheel={handleWheel}
              onMouseEnter={() => setIsHoveringMap(true)}
              onMouseLeave={() => setIsHoveringMap(false)}
            >
              {/* Tracker Overlay Fixed at Bottom Left */}
              <AnimatePresence>
                {isHoveringMap && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-6 left-6 z-50 bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-4 pointer-events-none"
                  >
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Cursor Pos</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-xs text-blue-400 font-mono font-bold">LAT: {cursorCoords.lat > 0 ? '+' : ''}{cursorCoords.lat.toFixed(2)}°</span>
                      <span className="text-xs text-blue-400 font-mono font-bold">LNG: {cursorCoords.lng > 0 ? '+' : ''}{cursorCoords.lng.toFixed(2)}°</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                ref={mapContainerRef}
                drag 
                dragConstraints={{ left: -1000, right: 1000, top: -500, bottom: 500 }}
                dragElastic={0.1}
                animate={{ scale }}
                transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
                onMouseMove={handleMouseMove}
                className="w-full h-full relative flex items-center justify-center transform-gpu"
                style={{ transformOrigin: 'center center' }}
              >
                
                {/* Background Details & Grid */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="w-full h-full bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem]" />
                </div>

                {/* Graticules (Lat/Lng Lines) */}
                <div className="absolute inset-12 z-0 pointer-events-none opacity-10">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {latLines.map(lat => {
                      const { y } = projectCoords(lat, 0)
                      return <line key={`lat-${lat}`} x1="0" y1={y} x2="100" y2={y} stroke="#64748b" strokeWidth="0.1" />
                    })}
                    {lngLines.map(lng => {
                      const { x } = projectCoords(0, lng)
                      return <line key={`lng-${lng}`} x1={x} y1="0" x2={x} y2="100" stroke="#64748b" strokeWidth="0.1" />
                    })}
                  </svg>
                </div>

                {/* Radar Sweeper */}
                <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-500/10 pointer-events-none z-0">
                   <div className="absolute inset-0 rounded-full border border-blue-500/20 scale-75" />
                   <div className="absolute inset-0 rounded-full border border-blue-500/5 scale-50" />
                   <div className="absolute left-1/2 top-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent to-blue-500/30 origin-left animate-spin-slow" />
                </div>

                {/* Vector World Map */}
                <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center px-12 py-8">
                  <img 
                    src="/world.svg" 
                    alt="World Map" 
                    className="w-full h-full object-contain opacity-40 mix-blend-screen drop-shadow-[0_0_10px_rgba(56,189,248,0.2)] pointer-events-none" 
                    style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.5) contrast(0.8)' }} 
                    draggable={false}
                  />
                </div>

                {/* Map Data Overlay (SVG Paths) */}
                <div className="absolute inset-12 z-10 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {siteData.map((site: any, i: any) => 
                      siteData.slice(i + 1).map((other: any) => {
                        const sX = site.coords.x
                        const sY = site.coords.y
                        const oX = other.coords.x
                        const oY = other.coords.y
                        
                        // Draw curved paths for realism
                        const midX = (sX + oX) / 2
                        const midY = (sY + oY) / 2 - 10
                        const pathD = `M ${sX} ${sY} Q ${midX} ${midY} ${oX} ${oY}`

                        const isHighlighted = selectedSiteId === site.id || selectedSiteId === other.id

                        return (
                          <motion.path 
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: isHighlighted ? 0.8 : 0.2 }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                            key={`link-${site.id}-${other.id}`}
                            d={pathD}
                            fill="none"
                            stroke={isHighlighted ? "#60a5fa" : "#475569"} 
                            strokeWidth={isHighlighted ? 0.3 / scale : 0.1 / scale} 
                            strokeDasharray={isHighlighted ? "1 0.5" : "0.5 1"}
                          />
                        )
                      })
                    )}
                  </svg>
                </div>

                {/* Node Markers */}
                <div className="absolute inset-12 z-20 pointer-events-none">
                  {/* Active Sites */}
                  {siteData.map((site: any, i: any) => {
                    const isSelected = selectedSiteId === site.id
                    const isHealthy = site.healthIndex > 80
                    const colorClass = isHealthy ? 'bg-emerald-500' : site.healthIndex > 50 ? 'bg-amber-500' : 'bg-red-500'
                    const ringColor = isHealthy ? 'border-emerald-400' : site.healthIndex > 50 ? 'border-amber-400' : 'border-red-400'

                    // Inverse scale markers to keep them visible at all zoom levels
                    const markerScale = 1 / Math.max(scale * 0.8, 1)

                    return (
                      <motion.div 
                        key={site.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: markerScale, opacity: 1 }}
                        transition={{ delay: i * 0.1, type: "spring" }}
                        className="absolute pointer-events-auto cursor-pointer"
                        style={{ left: `${site.coords.x}%`, top: `${site.coords.y}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => { e.stopPropagation(); setSelectedSiteId(isSelected ? null : site.id); setSelectedRegionId(null) }}
                      >
                        <div className="relative group/site flex items-center justify-center">
                          <div className={`w-3 h-3 rounded-full border-[2.5px] border-[#020617] ${colorClass} shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10 transition-transform duration-200 ${isSelected ? 'scale-125' : 'group-hover/site:scale-150'}`} />
                          {isSelected && (
                            <>
                              <div className={`absolute w-12 h-12 border ${ringColor} rounded-full animate-ping opacity-20 pointer-events-none`} />
                              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-[9px] font-bold px-2 py-1 rounded text-white whitespace-nowrap z-50 shadow-xl">
                                {site.name}
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}

                  {/* Expansion Targets */}
                  {unclaimedRegions.map((region, i) => {
                    const isSelected = selectedRegionId === region.region
                    const isCore = region.type === 'core'
                    const markerScale = 1 / Math.max(scale * 0.8, 1)

                    return (
                      <motion.div 
                        key={region.region}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: markerScale, opacity: 1 }}
                        transition={{ delay: 0.5 + i * 0.05 }}
                        className="absolute pointer-events-auto cursor-pointer"
                        style={{ left: `${region.coords.x}%`, top: `${region.coords.y}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => { e.stopPropagation(); setSelectedRegionId(isSelected ? null : region.region); setSelectedSiteId(null) }}
                      >
                        <div className="relative group/region flex items-center justify-center">
                          <div className={`w-2.5 h-2.5 rounded-sm border-2 transition-all duration-200 flex items-center justify-center bg-[#020617] shadow-lg z-10
                            ${isCore ? 'border-purple-500 text-purple-400' : 'border-slate-500 text-slate-400'}
                            ${isSelected ? 'scale-150 bg-slate-800' : 'group-hover/region:scale-150'}
                          `}>
                            <Crosshair className="w-1.5 h-1.5 opacity-80" strokeWidth={3} />
                          </div>
                          {isSelected && (
                            <div className={`absolute w-10 h-10 border ${isCore ? 'border-purple-500' : 'border-slate-500'} rounded-sm animate-ping opacity-20 pointer-events-none`} />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            </div>

            {/* Right Panel - Details Drawer */}
            <AnimatePresence mode="wait">
              {(selectedSite || selectedRegion) && (
                <motion.div 
                  initial={{ x: 320, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 320, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="w-80 border-l border-slate-800/50 bg-slate-900/60 backdrop-blur-md flex flex-col absolute right-0 top-0 bottom-0 z-40 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
                >
                  {selectedSite ? (
                    <div className="p-6 h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-8 border-b border-slate-800 pb-6">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/30 shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                           <Server className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-100 leading-tight">{selectedSite.name}</h2>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-bold text-slate-300 uppercase tracking-widest">{selectedSite.region}</span>
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-bold uppercase tracking-widest border border-indigo-500/20">{(selectedSite.type || 'edge').toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <div>
                          <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-3">Facility Health</h3>
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                            <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className={selectedSite.healthIndex > 80 ? 'text-emerald-500' : 'text-amber-500'} strokeDasharray={`${selectedSite.healthIndex}, 100`} strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              </svg>
                              <span className="absolute text-xs font-bold text-slate-200">{selectedSite.healthIndex}%</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">Operational</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">All systems functioning within nominal parameters.</p>
                            </div>
                          </div>
                        </div>

                        <div>
                           <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-3">Hardware Inventory</h3>
                           <div className="space-y-2">
                             <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                               <div className="flex items-center gap-2">
                                 <Cpu className="w-4 h-4 text-blue-400" />
                                 <span className="text-xs text-slate-300 font-medium">Compute</span>
                               </div>
                               <span className="text-sm font-bold text-slate-100">{selectedSite.nodeCount * 32} vCPU</span>
                             </div>
                             <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                               <div className="flex items-center gap-2">
                                 <MemoryIcon className="w-4 h-4 text-purple-400" />
                                 <span className="text-xs text-slate-300 font-medium">Memory</span>
                               </div>
                               <span className="text-sm font-bold text-slate-100">{Math.floor(selectedSite.nodeCount * 0.4)} TB</span>
                             </div>
                             <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                               <div className="flex items-center gap-2">
                                 <HardDrive className="w-4 h-4 text-emerald-400" />
                                 <span className="text-xs text-slate-300 font-medium">Storage</span>
                               </div>
                               <span className="text-sm font-bold text-slate-100">{Math.floor(selectedSite.nodeCount * 4)} TB</span>
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800 mt-4">
                        <button 
                          onClick={() => { setCurrentSiteId(selectedSite.id); toggleGlobalMap() }}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2"
                        >
                          <Zap className="w-3.5 h-3.5" /> Manage Datacenter
                        </button>
                      </div>
                    </div>
                  ) : selectedRegion ? (
                    <div className="p-6 h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-8 border-b border-slate-800 pb-6">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${selectedRegion.type === 'core' ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-slate-800 border-slate-700'}`}>
                           <Plus className={`w-6 h-6 ${selectedRegion.type === 'core' ? 'text-purple-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-100 leading-tight">{selectedRegion.name}</h2>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-bold text-slate-300 uppercase tracking-widest">{selectedRegion.region}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${selectedRegion.type === 'core' ? 'bg-purple-500/20 text-purple-300 border-purple-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                              {selectedRegion.type === 'core' ? 'Core Expansion' : 'Edge Expansion'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6 flex-1">
                        <div>
                          <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-3">Procurement Detail</h3>
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5">
                            <p className="text-[10px] text-slate-400 font-medium mb-1">Estimated CAPEX</p>
                            <p className="text-3xl font-black text-slate-100 tracking-tight">${selectedRegion.cost.toLocaleString()}</p>
                            
                            <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center">
                              <span className="text-[10px] text-slate-400">Time to Deploy</span>
                              <span className="text-[10px] font-bold text-emerald-400">Immediate</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-3">Location Telemetry</h3>
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
                             <div className="flex justify-between items-center">
                               <span className="text-[10px] text-slate-400">Latitude</span>
                               <span className="text-[11px] font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">{selectedRegion.geoCoords.lat.toFixed(4)}</span>
                             </div>
                             <div className="flex justify-between items-center">
                               <span className="text-[10px] text-slate-400">Longitude</span>
                               <span className="text-[11px] font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-800">{selectedRegion.geoCoords.lng.toFixed(4)}</span>
                             </div>
                             <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                               <span className="text-[10px] text-slate-400">Power Grid</span>
                               <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><Zap className="w-3 h-3" /> Stable</span>
                             </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800 mt-4">
                        <button 
                          onClick={() => { 
                            if (purchaseSite(selectedRegion.region, selectedRegion.name, selectedRegion.geoCoords, selectedRegion.cost, selectedRegion.type as 'core'|'edge')) {
                              setSelectedRegionId(null);
                            }
                          }}
                          className={`w-full py-3 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
                            selectedRegion.type === 'core' 
                              ? 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)]' 
                              : 'bg-slate-700 hover:bg-slate-600 shadow-lg'
                          }`}
                        >
                          <Crosshair className="w-3.5 h-3.5" /> Initialize Construction
                        </button>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

