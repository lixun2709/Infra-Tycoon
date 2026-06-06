import { useState } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Clock, ShieldAlert, ChevronRight } from 'lucide-react'
import { Badge } from './base/Badge'

import { useShallow } from 'zustand/react/shallow'

export const IncidentHUD = () => {
  const incidents = useInfraStore(useShallow(state => state.incidents.filter((i: any) => !i.isResolved)))
  const sites = useInfraStore(useShallow(state => state.sites))
  const triggerSiteFailover = useInfraStore(state => state.triggerSiteFailover)
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (incidents.length === 0) return null

  // Helper to format remaining RTO
  const formatTimeRemaining = (elapsed: number, target: number) => {
    const remaining = Math.max(0, target - elapsed)
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div 
      className="fixed top-24 right-8 z-50 pointer-events-none flex flex-col items-end gap-4 transition-all duration-500"
    >
      <div className="pointer-events-auto">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
          className="p-3 rounded-xl glass-panel border-rose-500/30 text-rose-500 hover:text-rose-400 hover:border-rose-500/50 transition-colors duration-200 flex items-center gap-3"
        >
          <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle size={18} className={isCollapsed ? 'animate-pulse' : ''} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            {isCollapsed ? `${incidents.length} ACTIVE INCIDENTS` : 'HIDE INCIDENTS'}
          </span>
          <ChevronRight size={16} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`} />
        </button>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-[340px] flex flex-col gap-4 pointer-events-auto"
          >
            {incidents.map((incident: any) => {
              const rto = incident.rtoTargetSeconds ?? 120
              const remaining = Math.max(0, rto - incident.elapsedSeconds)
              const ratio = Math.max(0, remaining / rto)
              
              // Color based on urgency
              const colorClass = ratio < 0.25 ? 'rose' : ratio < 0.5 ? 'orange' : 'amber'
              const colorHex = ratio < 0.25 ? '#f43f5e' : ratio < 0.5 ? '#f97316' : '#f59e0b'

              return (
                <motion.div
                  key={incident.id}
                  layout
                  className={`overflow-hidden rounded-[1.5rem] glass-panel border-${colorClass}-500/30 shadow-[0_12px_40px_rgba(244,63,94,0.15)] bg-black/40`}
                >
                  <div className={`px-6 py-4 border-b border-white/5 bg-${colorClass}-500/10`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-${colorClass}-500/20 border border-${colorClass}-500/30 text-${colorClass}-500`}>
                          <ShieldAlert size={20} className="animate-pulse" />
                        </div>
                        <div>
                          <h3 className={`text-[10px] font-black text-${colorClass}-500 uppercase tracking-[0.2em] leading-none mb-1.5`}>
                            {incident.severity} SEVERITY
                          </h3>
                          <p className="text-sm text-white font-black tracking-tight uppercase">
                            {incident.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="ghost" className={`bg-${colorClass}-500/10 text-${colorClass}-400 border border-${colorClass}-500/20`}>
                        {formatTimeRemaining(incident.elapsedSeconds, rto)}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Clock size={10} /> RTO TIMER
                        </span>
                        <span className={`text-[10px] font-mono font-bold text-${colorClass}-400`}>
                          {incident.elapsedSeconds}s / {rto}s
                        </span>
                      </div>
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full bg-${colorClass}-500 shadow-[0_0_10px_${colorHex}]`}
                          initial={{ width: '100%' }}
                          animate={{ width: `${Math.max(0, (remaining / rto) * 100)}%` }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {incident.type === 'drill' && (
                    <div className="px-6 py-2 border-b border-white/5 bg-black/40">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const targetSite = sites.find((s: any) => s.id !== incident.siteId)
                          if (targetSite) {
                            triggerSiteFailover(incident.siteId, targetSite.id)
                          }
                        }}
                        className="w-full py-2 rounded bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/50 text-indigo-400 font-bold text-[10px] tracking-widest uppercase transition-colors"
                      >
                        Execute Site Failover
                      </button>
                    </div>
                  )}

                  <div className="px-6 py-3 bg-black/60 flex items-center justify-between">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                      AFFECTED NODES: {incident.affectedNodes.length}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      SITE: {incident.siteId.toUpperCase()}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
