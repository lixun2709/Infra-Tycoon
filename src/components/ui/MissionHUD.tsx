import { useState } from 'react'
import { useMissionStore } from '../../store/useMissionStore'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Target, Trophy, ChevronRight, Activity, Zap } from 'lucide-react'

export const MissionHUD = () => {
  const { missions, activeMissionId } = useMissionStore()
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
        className="pointer-events-auto p-3 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-xl text-teal-400 hover:text-teal-300 hover:bg-slate-900 transition-all flex items-center gap-3 shadow-2xl"
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
            className="pointer-events-auto w-[340px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-3xl shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
          >
          {/* Rubrik-Style Header */}
          <div className="relative px-6 py-5 bg-gradient-to-br from-slate-900/50 to-slate-950/50">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.15)]">
                  <Activity size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-teal-500 uppercase tracking-[0.3em] leading-none mb-1.5">Operational Mission</h3>
                  <p className="text-base text-white font-black tracking-tight leading-none uppercase">{activeMission.title}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phase</span>
                <span className="text-xs font-black text-white">{activeMissionId?.toUpperCase()}</span>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4 max-w-[240px]">
              {activeMission.description}
            </p>

            {/* High-Contrast Progress System */}
            <div className="relative h-6 flex items-center">
              <div className="absolute inset-0 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                  className="h-full bg-gradient-to-r from-teal-600 to-teal-400 relative"
                >
                  {/* Scanner Glow Effect */}
                  <motion.div 
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                  />
                </motion.div>
              </div>
              <div className="absolute right-3 flex items-center gap-1.5">
                 <span className="text-[10px] font-black text-white drop-shadow-md">{Math.round(progressPercent)}%</span>
              </div>
            </div>
          </div>

          {/* Objectives List */}
          <div className="p-6 space-y-5 bg-black/20">
            {activeMission.objectives.map((obj, idx) => (
              <motion.div 
                key={obj.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.15 }}
                className={`relative flex gap-4 transition-all duration-500 ${obj.isComplete ? 'opacity-30' : 'opacity-100'}`}
              >
                {/* Visual Connector Line */}
                {idx < activeMission.objectives.length - 1 && (
                  <div className="absolute left-[9px] top-6 bottom-[-20px] w-[2px] bg-white/5" />
                )}

                <div className="mt-0.5 z-10">
                  {obj.isComplete ? (
                    <div className="w-[20px] h-[20px] rounded-full bg-teal-500 flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                      <CheckCircle2 size={14} className="text-slate-950 stroke-[3px]" />
                    </div>
                  ) : (
                    <div className="w-[20px] h-[20px] rounded-full border-2 border-slate-700 flex items-center justify-center group-hover:border-teal-400 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-teal-400 transition-colors" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`text-[13px] font-black tracking-wide transition-all ${obj.isComplete ? 'text-teal-400 line-through decoration-teal-900' : 'text-slate-100'}`}>
                    {obj.label}
                  </h4>
                  {!obj.isComplete && (
                    <p className="text-[10px] text-slate-500 mt-1 font-bold leading-tight uppercase tracking-wider">
                      {obj.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer Action */}
          {activeMission.status === 'completed' ? (
            <motion.div 
              initial={{ backgroundColor: "rgba(20, 184, 166, 0.05)" }}
              animate={{ backgroundColor: "rgba(20, 184, 166, 0.1)" }}
              whileHover={{ backgroundColor: "rgba(20, 184, 166, 0.2)" }}
              onClick={() => {
                const currentIndex = missions.findIndex(m => m.id === activeMissionId)
                if (currentIndex < missions.length - 1) {
                  useMissionStore.getState().startMission(missions[currentIndex + 1].id)
                }
              }}
              className="px-6 py-4 border-t border-teal-500/30 flex items-center justify-between cursor-pointer group/footer transition-colors"
            >
              <div className="flex items-center gap-3 text-teal-400">
                <div className="p-1.5 bg-teal-500/20 rounded-md">
                  <Trophy size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] block leading-none mb-1">Status</span>
                  <span className="text-xs font-black uppercase">Initialize Next Phase</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-teal-400 group-hover/footer:translate-x-1 transition-transform" />
            </motion.div>
          ) : (
            <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-teal-500" />
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">Telemetry Active</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-[10px] text-teal-400 font-mono font-black uppercase tracking-tighter">
                  {completedCount} / {totalCount} Ready
                </span>
              </div>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
