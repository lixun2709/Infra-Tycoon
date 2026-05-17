import React, { useState, useEffect } from 'react'
import { performanceMonitor } from '../../simulation/PerformanceMonitor'
import type { PerformanceMetrics } from '../../simulation/PerformanceMonitor'
import { 
  Activity, 
  Cpu, 
  Database, 
  Zap, 
  Clock, 
  ShieldAlert, 
  HardDrive, 
  Layers, 
  Globe 
} from 'lucide-react'

export const PerformanceOverlay: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(performanceMonitor.getMetrics())
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setIsVisible(v => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    
    const interval = setInterval(() => {
      if (isVisible) {
        setMetrics(performanceMonitor.getMetrics())
      }
    }, 500)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearInterval(interval)
    }
  }, [isVisible])

  if (!isVisible) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      case 'restarting': return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      case 'failed': return 'text-rose-400 border-rose-500/30 bg-rose-500/10'
      default: return 'text-slate-500 border-slate-700 bg-slate-800/50'
    }
  }

  const formatBytes = (bytes?: number): string => {
    if (bytes === undefined) return 'N/A'
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="fixed top-20 left-4 z-[100] w-80 bg-slate-950/85 backdrop-blur-xl border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 shadow-2xl pointer-events-none select-none transition-all duration-300">
      {/* Cyber Panel Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="font-bold text-slate-200 uppercase tracking-widest text-[10px]">DIAGNOSTIC SYSTEM HUD</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">F2 TO CLOSE</span>
      </div>

      <div className="space-y-3.5">
        {/* Row 1: Core Host Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/50 border border-slate-900 rounded-lg p-2 flex flex-col justify-between h-14">
            <span className="text-slate-500 text-[9px] uppercase tracking-wider">Main Thread</span>
            <div className="flex justify-between items-baseline mt-1">
              <span className={`${metrics.fps > 55 ? 'text-emerald-400' : 'text-amber-400'} text-base font-bold`}>{metrics.fps}</span>
              <span className="text-[9px] text-slate-500">FPS ({metrics.frameTime.toFixed(1)}ms)</span>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-900 rounded-lg p-2 flex flex-col justify-between h-14">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[9px] uppercase tracking-wider">JS Heap Memory</span>
              <HardDrive className="w-3 h-3 text-sky-400 opacity-60" />
            </div>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-sky-400 font-bold text-xs">{formatBytes(metrics.usedJSHeapSize)}</span>
              <span className="text-[8px] text-slate-500">of {formatBytes(metrics.totalJSHeapSize)}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Sim Worker Diagnostics */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-lg p-2.5 space-y-2">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/50">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Simulation Worker Thread
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${getStatusColor(metrics.workerStatus)}`}>
              {metrics.workerStatus.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-40" /> Tick duration
              </span>
              <span className="text-indigo-400 font-semibold">
                {metrics.simTickTime === 0 || metrics.simTickTime < 0.001 
                  ? '< 0.001ms' 
                  : `${metrics.simTickTime.toFixed(3)}ms`}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 flex items-center gap-1">
                <Zap className="w-3 h-3 opacity-40" /> Thread latency
              </span>
              <span className="text-slate-300 font-semibold">{metrics.workerLatency.toFixed(1)}ms</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 flex items-center gap-1">
                <Database className="w-3 h-3 opacity-40" /> Total entities
              </span>
              <span className="text-slate-300 font-semibold">{metrics.entityCount}</span>
            </div>

            {metrics.restartCount > 0 && (
              <div className="flex justify-between items-center col-span-2 text-rose-400 border border-rose-500/20 bg-rose-500/5 p-1 rounded mt-1">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Worker Thread Restarts
                </span>
                <span className="font-bold">{metrics.restartCount}</span>
              </div>
            )}
          </div>
        </section>

        {/* Row 3: ECS Cache Telemetry */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-lg p-2.5 space-y-2">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/50">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              ECS Query Cache Evaluator
            </span>
            <span className="text-emerald-400 font-bold text-[10px]">
              {(metrics.cacheHitRatio * 100).toFixed(1)}% HIT
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Active Queries</span>
              <span className="text-slate-300 font-semibold">{metrics.activeQueries}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Hits / Misses</span>
              <span className="text-slate-400 font-semibold">{metrics.queryHits} / {metrics.queryMisses}</span>
            </div>
          </div>
        </section>

        {/* Row 4: 3D Graphics & GPU parameters */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-lg p-2.5 space-y-2">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/50">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              WebGL Graphics Renderer
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">WebGL Draw Calls</span>
              <span className="text-amber-400 font-bold">{metrics.drawCalls}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Triangles Count</span>
              <span className="text-slate-300 font-semibold">{metrics.triangles.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Geometries Load</span>
              <span className="text-slate-300 font-semibold">{metrics.geometries}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Textures Load</span>
              <span className="text-slate-300 font-semibold">{metrics.textures}</span>
            </div>
          </div>
        </section>

        {/* Row 5: Multiplayer Telemetry */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-lg p-2.5 space-y-2">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-900/50">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-pink-400" />
              Multiplayer Connection
            </span>
            <span className="text-[8px] text-pink-400/80 font-bold tracking-wider px-1.5 py-0.5 rounded border border-pink-500/20 bg-pink-500/5">READY</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Ping RTT</span>
              <span className="text-slate-400 font-semibold">0.0 ms (Local)</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Packet Loss</span>
              <span className="text-slate-400 font-semibold">0.00%</span>
            </div>
          </div>
        </section>

        {/* System Breakdown Subsystems */}
        {Object.keys(metrics.systemTimings).length > 0 && (
          <section className="bg-slate-900/25 border border-slate-900/40 rounded-lg p-2.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1 pb-1 border-b border-slate-900/30">
              <Cpu className="w-3 h-3 text-sky-400" />
              Subsystem Performance Breakdown
            </div>
            <div className="space-y-2">
              {Object.entries(metrics.systemTimings).map(([name, time]) => (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="truncate max-w-[150px] text-slate-400 font-semibold">{name}</span>
                    <span className="text-slate-300">
                      {time === 0 || time < 0.0001 
                        ? '< 0.0001ms' 
                        : `${time.toFixed(4)}ms`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded transition-all duration-300"
                      style={{ 
                        width: `${metrics.simTickTime > 0 
                          ? Math.min(100, (time / metrics.simTickTime) * 100) 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pt-2 border-t border-slate-900 text-[8px] text-slate-600 flex justify-between items-center uppercase tracking-widest font-bold">
          <span>Engine Status: Operational</span>
          <Zap className="w-3 h-3 text-emerald-500" />
        </div>
      </div>
    </div>
  )
}
