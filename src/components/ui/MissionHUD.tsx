import { useState } from 'react'
import { useMissionStore } from '../../store/useMissionStore'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Target, Trophy, ChevronRight, Activity, Zap } from 'lucide-react'
import { Badge } from './base/Badge'
import { Button } from './base/Button'

export const MissionHUD = () => {
  const { missions, activeMissionId, startMission } = useMissionStore()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const activeMission = missions.find(m => m.id === activeMissionId)

  if (!activeMission) return null

  const completedCount = activeMission.objectives.filter(o => o.isComplete).length
  const totalCount = activeMission.objectives.length
  const progressPercent = (completedCount / totalCount) * 100

  return (
    <div className="fixed z-50 left-8 bottom-8 pointer-events-none flex flex-col items-start gap-4">
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="pointer-events-auto p-3 rounded-xl glass-teal text-teal-400 hover:text-teal-300 transition-all flex items-center gap-3 shadow-2xl"
      >
        <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
          <Target size={18} className={isCollapsed ? 'animate-pulse' : ''} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isCollapsed ? 'Maximize Objectives' : 'Minimize HUD'}</span>
        <ChevronRight size={16} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`} />
      </button>

      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            key={activeMission.id}
            initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            className="pointer-events-auto w-[340px] overflow-hidden rounded-xl glass-dark shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
          >
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-white/5 bg-white/5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-[0_0_20px_var(--primary-glow)]">
                  <Activity size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-teal-500 uppercase tracking-[0.3em] leading-none mb-1.5">Operational Mission</h3>
                  <p className="text-base text-white font-black tracking-tight leading-none uppercase">{activeMission.title}</p>
                </div>
              </div>
              <Badge variant="ghost" className="opacity-50">{activeMissionId?.toUpperCase()}</Badge>
            </div>
            
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4">
              {activeMission.description}
            </p>

            {/* Progress Bar */}
            <div className="relative h-2 flex items-center">
              <div className="absolute inset-0 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                  className="h-full bg-teal-500 shadow-[0_0_10px_var(--primary)]"
                />
              </div>
            </div>
            <div className="flex justify-between items-center mt-2">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progress Fleet Deployment</span>
               <span className="text-[10px] font-black text-teal-400 font-mono tracking-tighter">{Math.round(progressPercent)}%</span>
            </div>
          </div>

          {/* Objectives List */}
          <div className="p-6 space-y-5 bg-black/20">
            {activeMission.objectives.map((obj, idx) => (
              <motion.div 
                key={obj.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative flex gap-4 transition-all duration-500 ${obj.isComplete ? 'opacity-30' : 'opacity-100'}`}
              >
                <div className="mt-0.5 z-10">
                  {obj.isComplete ? (
                    <div className="w-[18px] h-[18px] rounded-full bg-teal-500 flex items-center justify-center shadow-[0_0_15px_var(--primary-glow)]">
                      <CheckCircle2 size={12} className="text-slate-950 stroke-[4px]" />
                    </div>
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full border border-slate-700 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`text-[12px] font-black tracking-wide ${obj.isComplete ? 'text-teal-400 line-through' : 'text-slate-100'}`}>
                    {obj.label}
                  </h4>
                  {!obj.isComplete && (
                    <p className="text-[9px] text-slate-500 mt-1 font-bold leading-tight uppercase tracking-widest">
                      {obj.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer Action */}
          <div className="px-6 py-4 border-t border-white/5 bg-black/40">
            {activeMission.status === 'completed' ? (
              <Button 
                variant="primary" 
                className="w-full justify-center text-[10px] font-black tracking-widest"
                onClick={() => {
                  const currentIndex = missions.findIndex(m => m.id === activeMissionId)
                  if (currentIndex < missions.length - 1) {
                    const nextMission = missions[currentIndex + 1]
                    if (nextMission) {
                      startMission(nextMission.id)
                    }
                  }
                }}
                icon={<Trophy size={14} />}
              >
                INITIALIZE NEXT PHASE
              </Button>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-teal-500" />
                  <span className="text-[8px] text-slate-500 uppercase font-black tracking-[0.2em]">Telemetry Active</span>
                </div>
                <Badge variant="info" className="font-mono">{completedCount} / {totalCount} READY</Badge>
              </div>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
