/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { SimTelemetryPayload } from '../../simulation/worker/workerTypes'
import { AlertCircle, Activity, Server, Clock, GitCommit, Database, Zap } from 'lucide-react'

export const ObservabilityDashboard: React.FC = () => {
  const [telemetry, setTelemetry] = useState<SimTelemetryPayload | null>(null)
  
  // Subscribe directly to the Zustand store using transient updates to prevent React from 
  // triggering 60FPS top-level re-renders when other states change, but still get telemetry updates.
  useEffect(() => {
    let lastUpdate = 0
    const unsubscribe = useInfraStore.subscribe((state) => {
       
      const anyState = state as any
      if (anyState._lastTelemetry) {
        const now = performance.now()
        // Throttle React state updates to 500ms to preserve UI smoothness
        if (now - lastUpdate > 500) {
          setTelemetry(anyState._lastTelemetry)
          lastUpdate = now
        }
      }
    })
    
    return unsubscribe
  }, [])

  const alerts = useInfraStore(state => state.alerts)

  if (!telemetry) {
    return (
      <div className="w-full h-full p-8 text-cyan-500 font-mono flex items-center justify-center">
        <Activity className="animate-spin mr-3" /> Waiting for telemetry stream...
      </div>
    )
  }

  const { simStats, spans, queryTelemetry, tickDurationMs } = telemetry

  return (
    <div className="w-full h-full bg-slate-900/90 text-slate-300 font-mono p-6 overflow-y-auto space-y-6 flex-1 border border-slate-700/50 rounded-lg shadow-2xl backdrop-blur-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
        <div>
          <h2 className="text-2xl font-black text-cyan-400 tracking-wider flex items-center gap-2">
            <Activity className="w-6 h-6" /> OBSERVABILITY METRICS
          </h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
            Enterprise Datacenter Telemetry & Distributed Tracing
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-teal-400">{(1000 / Math.max(1, tickDurationMs)).toFixed(1)} TPS</div>
          <div className="text-xs text-slate-500 uppercase">Worker Tick Rate</div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={<Server className="w-4 h-4 text-emerald-400" />} 
          label="Active Entities" 
          value={telemetry.entityCount.toLocaleString()} 
        />
        <MetricCard 
          icon={<Clock className="w-4 h-4 text-blue-400" />} 
          label="Avg Uptime Ratio" 
          value={`${((simStats?.averageUptimeRatio || 0) * 100).toFixed(2)}%`} 
        />
        <MetricCard 
          icon={<Zap className="w-4 h-4 text-yellow-400" />} 
          label="Total Power Draw" 
          value={`${(simStats?.totalPowerDrawKW || 0).toFixed(1)} kW`} 
        />
        <MetricCard 
          icon={<Database className="w-4 h-4 text-purple-400" />} 
          label="ECS Cache Hit" 
          value={`${((queryTelemetry?.cacheHitRatio || 0) * 100).toFixed(1)}%`} 
        />
      </div>

      {/* Tracing Subsystem (Jaeger-style view) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded p-4">
        <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
          <GitCommit className="w-5 h-5" /> Distributed Tracing (Spans)
        </h3>
        
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {spans && spans.length > 0 ? spans.slice().reverse().map((span, idx) => (
            <div key={idx} className="flex flex-col bg-slate-900/50 p-2 rounded border border-slate-800/80 text-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-cyan-300">{span.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${
                  span.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                  span.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {span.status}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Trace: {span.traceId} {span.parentSpanId && `(Parent: ${span.parentSpanId})`}</span>
                <span>{span.durationMs ? `${span.durationMs.toFixed(2)}ms` : 'running...'}</span>
              </div>
            </div>
          )) : (
            <div className="text-slate-500 italic text-sm py-4 text-center">No trace spans available.</div>
          )}
        </div>
      </div>

      {/* Active Alerts Subsystem */}
      <div className="bg-slate-800/50 border border-slate-700 rounded p-4">
        <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> Operational Alerts Registry
        </h3>
        
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {alerts.length > 0 ? alerts.map((alert: any, idx: any) => (
            <div key={idx} className={`p-3 rounded border text-sm ${
              alert.severity === 'critical' ? 'bg-red-900/20 border-red-800/50 text-red-200' :
              alert.severity === 'warning' ? 'bg-yellow-900/20 border-yellow-800/50 text-yellow-200' :
              'bg-blue-900/20 border-blue-800/50 text-blue-200'
            }`}>
              <div className="flex justify-between font-bold mb-1">
                <span className="uppercase">{alert.severity}</span>
                <span className="opacity-70 text-xs">{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
              <div>{alert.message}</div>
              {alert.nodeId && <div className="text-xs opacity-70 mt-1">Source: {alert.nodeId}</div>}
            </div>
          )) : (
            <div className="text-emerald-500/70 italic text-sm py-4 text-center">All systems nominal. No active alerts.</div>
          )}
        </div>
      </div>

    </div>
  )
}

const MetricCard: React.FC<{ icon: React.ReactNode, label: string, value: string | number }> = ({ icon, label, value }) => (
  <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded flex flex-col gap-1">
    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
      {icon} {label}
    </div>
    <div className="text-xl font-black text-slate-100">{value}</div>
  </div>
)

