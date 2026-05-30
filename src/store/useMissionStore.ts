import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { MISSION_CATALOG, MISSION_ORDER } from '../physics/missionLibrary'
import { useInfraStore } from './useInfraStore'
import { audioManager } from '../utils/AudioManager'
import type { InfraState } from './infraStoreTypes'

type MissionState = {
  activeMissionId: string | null
  completedMissionIds: string[]
  completedObjectiveIds: string[]
  
  // Actions
  startMission: (id: string) => void
  evaluateActiveMission: (infraState: InfraState) => void
  resetMissions: () => void
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      activeMissionId: 'm1',
      completedMissionIds: [],
      completedObjectiveIds: [],

      startMission: (id) => set({ activeMissionId: id }),

      evaluateActiveMission: (infraState) => {
        const { activeMissionId, completedObjectiveIds, completedMissionIds } = get()
        if (!activeMissionId) return

        const mission = MISSION_CATALOG[activeMissionId]
        if (!mission) return

        let newlyCompletedObj = false
        const newCompletedObjIds = [...completedObjectiveIds]

        // Check each objective
        for (const obj of mission.objectives) {
          if (!newCompletedObjIds.includes(obj.id)) {
            const isComplete = obj.evaluate(infraState)
            if (isComplete) {
              newCompletedObjIds.push(obj.id)
              newlyCompletedObj = true
            }
          }
        }

        if (newlyCompletedObj) {
          set({ completedObjectiveIds: newCompletedObjIds })

          // Check if mission is fully complete
          const allComplete = mission.objectives.every(obj => newCompletedObjIds.includes(obj.id))
          
          if (allComplete) {
            // Reward the player using useInfraStore
            if (mission.rewardCash) {
              useInfraStore.setState(s => ({ balance: s.balance + (mission.rewardCash as number) }))
            }
            if (mission.rewardXp && useInfraStore.getState().gainXp) {
              useInfraStore.getState().gainXp(mission.rewardXp, `Mission Complete: ${mission.title}`)
            }
            
            // Audio feedback
            audioManager.playEffect('success')
            useInfraStore.getState().pushAlert('info', `MISSION ACCOMPLISHED: ${mission.title}`)

            const newCompletedMissions = [...completedMissionIds, activeMissionId]
            
            // Auto-advance to next mission
            const currentIndex = MISSION_ORDER.indexOf(activeMissionId)
            let nextMissionId = null
            if (currentIndex !== -1 && currentIndex < MISSION_ORDER.length - 1) {
              nextMissionId = MISSION_ORDER[currentIndex + 1]
            }

            set({
              completedMissionIds: newCompletedMissions,
              activeMissionId: nextMissionId
            })
          }
        }
      },

      resetMissions: () => set({ 
        activeMissionId: 'm1', 
        completedMissionIds: [], 
        completedObjectiveIds: [] 
      })
    }),
    {
      name: 'infra-tycoon-missions-v3', // bumped version
      storage: createJSONStorage(() => localStorage)
    }
  )
)

