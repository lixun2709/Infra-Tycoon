import { useMissionStore } from '../../store/useMissionStore'
import { MISSION_CATALOG, MISSION_ORDER } from '../../physics/missionLibrary'
import type { MissionBlueprint, ObjectiveBlueprint } from '../../physics/missionLibrary'
import { motion } from 'framer-motion'
import { CheckCircle2, Target, Trophy, Activity, Zap } from 'lucide-react'
import { Badge } from './system/Badge'
import { Button } from './system/Button'
import { Modal } from './system'

interface MissionDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export const MissionDashboard = ({ isOpen, onClose }: MissionDashboardProps) => {
  const { activeMissionId, completedObjectiveIds, startMission } = useMissionStore()
  
  if (!isOpen) return null
  
  const activeMission = activeMissionId ? MISSION_CATALOG[activeMissionId] : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mission Control" icon={<Target size={18} />}>
      {!activeMission ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Trophy size={48} className="text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">No Active Missions</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You have completed all available operational directives. Stand by for future expansions.
          </p>
        </div>
      ) : (
        <MissionContent 
          activeMission={activeMission} 
          completedObjectiveIds={completedObjectiveIds} 
          startMission={startMission} 
        />
      )}
    </Modal>
  )
}

const MissionContent = ({ 
  activeMission, 
  completedObjectiveIds, 
  startMission 
}: { 
  activeMission: MissionBlueprint
  completedObjectiveIds: string[]
  startMission: (id: string) => void
}) => {
  const completedCount = activeMission.objectives.filter((o: ObjectiveBlueprint) => completedObjectiveIds.includes(o.id)).length
  const totalCount = activeMission.objectives.length
  const progressPercent = (completedCount / totalCount) * 100
  const isMissionComplete = completedCount === totalCount

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="relative px-6 py-5 rounded-2xl border border-white/5 bg-slate-800/50 shadow-inner">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Activity size={24} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] leading-none mb-2">Operational Mission</h3>
              <p className="text-xl text-white font-black tracking-tight leading-none uppercase">{activeMission.title}</p>
            </div>
          </div>
          <Badge variant="ghost" className="bg-blue-500/5 text-blue-400 border border-blue-500/20 px-3 py-1 text-xs">
            {activeMission.id?.toUpperCase()}
          </Badge>
        </div>
        
        <p className="text-sm text-slate-300 font-medium leading-relaxed mb-6 max-w-2xl">
          {activeMission.description}
        </p>

        <div className="relative h-3 flex items-center mb-2">
          <div className="absolute inset-0 bg-slate-900 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className="h-full bg-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-between items-center mb-4">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progress Fleet Deployment</span>
           <span className="text-xs font-black text-blue-400 font-mono tracking-tighter">{Math.round(progressPercent)}%</span>
        </div>

        {(activeMission.rewardCash || activeMission.rewardXp) && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Rewards:</span>
            {activeMission.rewardCash && (
              <Badge variant="ghost" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-1">
                ${activeMission.rewardCash.toLocaleString()}
              </Badge>
            )}
            {activeMission.rewardXp && (
              <Badge variant="ghost" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 py-1">
                +{activeMission.rewardXp} XP
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2">Objectives</h4>
        <div className="grid grid-cols-1 gap-3">
          {activeMission.objectives.map((obj: ObjectiveBlueprint, idx: number) => {
            const isComplete = completedObjectiveIds.includes(obj.id)
            return (
              <motion.div 
                key={obj.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative flex gap-4 p-4 rounded-xl border transition-all duration-500 ${
                  isComplete 
                    ? 'border-blue-500/20 bg-blue-500/5 opacity-50' 
                    : 'border-white/10 bg-slate-800/50 hover:bg-slate-700/50'
                }`}
              >
                <div className="mt-1 z-10 shrink-0">
                  {isComplete ? (
                    <div className="w-[22px] h-[22px] rounded-full bg-blue-500 flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-white stroke-[4px]" />
                    </div>
                  ) : (
                    <div className="w-[22px] h-[22px] rounded-full border-2 border-blue-500/30 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-black tracking-wide ${isComplete ? 'text-blue-400 line-through font-bold' : 'text-slate-100'}`}>
                    {obj.label}
                  </h4>
                  {!isComplete && (
                    <p className="text-[10px] text-slate-400 mt-1.5 font-bold leading-relaxed uppercase tracking-widest">
                      {obj.description}
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-white/5">
        {isMissionComplete ? (
          <Button 
            variant="primary" 
            className="w-full justify-center py-4 text-xs font-black tracking-widest bg-blue-600 hover:bg-blue-500 text-white border-none shadow-[0_4px_20px_rgba(37,99,235,0.3)]"
            onClick={() => {
              const currentIndex = activeMission.id ? MISSION_ORDER.indexOf(activeMission.id) : -1
              if (currentIndex !== -1 && currentIndex < MISSION_ORDER.length - 1) {
                const nextMission = MISSION_ORDER[currentIndex + 1]
                if (nextMission) {
                  startMission(nextMission)
                }
              }
            }}
            icon={<Trophy size={16} />}
          >
            INITIALIZE NEXT PHASE
          </Button>
        ) : (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-white/5">
            <div className="flex items-center gap-3">
              <Zap size={16} className="text-blue-500" />
              <span className="text-[10px] text-blue-400 uppercase font-black tracking-[0.2em] animate-pulse">Telemetry Active</span>
            </div>
            <Badge variant="ghost" className="font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 py-1 px-3">
              {completedCount} / {totalCount} READY
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
