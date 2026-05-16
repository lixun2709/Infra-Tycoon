import React, { useState, useEffect } from 'react'
import { performanceMonitor } from '../../simulation/PerformanceMonitor'
import type { PerformanceMetrics } from '../../simulation/PerformanceMonitor'
import { Activity, Cpu, Database, Zap, Clock } from 'lucide-react'

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

  return (
    <div className="fixed top-20 right-4 z-[100] w-64 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg p-4 font-mono text-xs text-slate-300 shadow-2xl pointer-events-none">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-700 pb-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-slate-100 uppercase tracking-wider">Performance Engine</span>
      </div>

      <div className="space-y-4">
        {/* Main Thread Metrics */}
        <section>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-500">Main Thread</span>
            <span className={`${metrics.fps > 55 ? 'text-emerald-400' : 'text-amber-400'} font-bold`}>{metrics.fps} FPS</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span>Frame Time</span>
            <span>{metrics.frameTime.toFixed(2)}ms</span>
          </div>
        </section>

        {/* Worker & Sim Metrics */}
        <section className="space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-500">Sim Worker</span>
            <span className="text-blue-400 font-bold">{metrics.simTickTime.toFixed(3)}ms</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 opacity-50" />
              <span>Latency</span>
            </div>
            <span>{metrics.workerLatency.toFixed(1)}ms</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 opacity-50" />
              <span>Entities</span>
            </div>
            <span>{metrics.entityCount}</span>
          </div>
        </section>

        {/* System Breakdown */}
        <section>
          <div className="text-[10px] text-slate-500 uppercase mb-2 border-t border-slate-800 pt-2 flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            <span>System Breakdown</span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(metrics.systemTimings).map(([name, time]) => (
              <div key={name} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[9px]">
                  <span className="truncate max-w-[120px]">{name}</span>
                  <span>{time.toFixed(4)}ms</span>
                </div>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (time / metrics.simTickTime) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-2 border-t border-slate-800 text-[9px] text-slate-600 flex justify-between">
          <span>Simulation Stable</span>
          <Zap className="w-3 h-3" />
        </div>
      </div>
    </div>
  )
}
