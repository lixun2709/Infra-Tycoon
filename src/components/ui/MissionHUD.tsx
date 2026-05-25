import { useState } from 'react'
import { useMissionStore } from '../../store/useMissionStore'
import { useInfraStore } from '../../store/useInfraStore'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Target, Trophy, ChevronRight, Activity, Zap, Move } from 'lucide-react'
import { Badge } from './base/Badge'
import { Button } from './base/Button'

export const MissionHUD = () => {
  const { missions, activeMissionId, startMission } = useMissionStore()
  const selectedNodeId = useInfraStore(state => state.selectedNodeId)
  const hasThermalWarning = useInfraStore(state => state.totalRoomBTU > 50000)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [positionMode, setPositionMode] = useState<'bottom-left' | 'top-left' | 'bottom-right' | 'top-right'>('bottom-left')
  
  const activeMission = missions.find(m => m.id === activeMissionId)

  if (!activeMission) return null

  const completedCount = activeMission.objectives.filter(o => o.isComplete).length
  const totalCount = activeMission.objectives.length
  const progressPercent = (completedCount / totalCount) * 100

  const cyclePosition = (e: React.MouseEvent) => {
    e.stopPropagation()
    const modes: ('bottom-left' | 'top-left' | 'bottom-right' | 'top-right')[] = [
      'bottom-left',
      'top-left',
      'top-right',
      'bottom-right'
    ]
    const currentIndex = modes.indexOf(positionMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setPositionMode(modes[nextIndex]!)
  }

  const getPositionStyle = () => {
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 50,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: positionMode.includes('left') ? 'flex-start' : 'flex-end',
      gap: '1rem',
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    }

    const isInspectorOpen = !!selectedNodeId

    if (positionMode.includes('bottom')) {
      style.bottom = hasThermalWarning && positionMode === 'bottom-left' ? '9rem' : '2rem'
      style.top = 'auto'
    } else {
      style.top = positionMode === 'top-left' && !isInspectorOpen ? '23rem' : '5.5rem'
      style.bottom = 'auto'
    }

    if (positionMode.includes('left')) {
      style.left = '2rem'
      style.right = 'auto'
    } else {
      style.right = isInspectorOpen ? '22rem' : '2rem'
      style.left = 'auto'
    }

    return style
  }

  return (
    <div 
      style={getPositionStyle()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
          className="p-3 rounded-xl glass-panel border-[#ff5a36]/30 text-[#ff5a36] hover:text-[#ff7b5c] hover:border-[#ff7b5c]/50 transition-colors duration-200 flex items-center gap-3"
        >
          <div className="p-1.5 rounded-lg bg-[#ff5a36]/10 border border-[#ff5a36]/20">
            <Target size={18} className={isCollapsed ? 'animate-pulse' : ''} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isCollapsed ? 'Maximize Objectives' : 'Minimize HUD'}</span>
          <ChevronRight size={16} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`} />
        </button>

        <button
          onClick={cyclePosition}
          title="Reposition HUD Window"
          className="p-3 rounded-xl glass-panel border-[#ff5a36]/30 text-[#ff5a36] hover:text-[#ff7b5c] hover:border-[#ff7b5c]/50 transition-colors duration-200 flex items-center justify-center"
        >
          <Move size={18} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            key={activeMission.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ type: "tween", duration: 0.2 }}
            className="pointer-events-auto w-[340px] overflow-hidden rounded-[1.5rem] glass-panel border-[#ff5a36]/30 shadow-[0_12px_40px_rgba(255,90,54,0.15)]"
          >
            <div className="relative px-6 py-5 border-b border-white/5 bg-[#ff5a36]/5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#ff5a36]/10 border border-[#ff5a36]/20 text-[#ff5a36] shadow-[0_0_15px_rgba(255,90,54,0.15)]">
                    <Activity size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-[#ff5a36] uppercase tracking-[0.3em] leading-none mb-1.5">Operational Mission</h3>
                    <p className="text-base text-white font-black tracking-tight leading-none uppercase">{activeMission.title}</p>
                  </div>
                </div>
                <Badge variant="ghost" className="bg-[#ff5a36]/5 text-[#ff5a36] border border-[#ff5a36]/10">{activeMissionId?.toUpperCase()}</Badge>
              </div>
              
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4">
                {activeMission.description}
              </p>

              <div className="relative h-2 flex items-center">
                <div className="absolute inset-0 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="h-full bg-gradient-to-r from-[#ff5a36] to-[#ff7b5c] shadow-[0_0_10px_rgba(255,90,54,0.3)]"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Progress Fleet Deployment</span>
                 <span className="text-[10px] font-black text-[#ff5a36] font-mono tracking-tighter">{Math.round(progressPercent)}%</span>
              </div>
            </div>

            <div className="p-6 space-y-5 bg-black/40">
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
                      <div className="w-[18px] h-[18px] rounded-full bg-[#ff5a36] flex items-center justify-center shadow-[0_0_10px_rgba(255,90,54,0.4)]">
                        <CheckCircle2 size={12} className="text-slate-950 stroke-[4px]" />
                      </div>
                    ) : (
                      <div className="w-[18px] h-[18px] rounded-full border border-[#ff5a36]/30 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff5a36]" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-[12px] font-black tracking-wide ${obj.isComplete ? 'text-[#ff5a36] line-through font-bold' : 'text-slate-100'}`}>
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

            <div className="px-6 py-4 border-t border-white/5 bg-black/60">
              {activeMission.status === 'completed' ? (
                <Button 
                  variant="primary" 
                  className="w-full justify-center text-[10px] font-black tracking-widest bg-[#ff5a36] hover:bg-[#ff7b5c] text-white border-none shadow-[0_4px_20px_rgba(255,90,54,0.3)]"
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
                    <Zap size={12} className="text-[#ff5a36]" />
                    <span className="text-[8px] text-[#ff5a36] uppercase font-black tracking-[0.2em] animate-pulse">Telemetry Active</span>
                  </div>
                  <Badge variant="ghost" className="font-mono bg-[#ff5a36]/5 text-[#ff5a36] border border-[#ff5a36]/15">{completedCount} / {totalCount} READY</Badge>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

