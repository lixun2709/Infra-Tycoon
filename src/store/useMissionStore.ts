import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Objective = {
  id: string
  label: string
  isComplete: boolean
  description: string
}

export type Mission = {
  id: string
  title: string
  description: string
  objectives: Objective[]
  status: 'locked' | 'active' | 'completed'
  reward?: string
}

type MissionState = {
  missions: Mission[]
  activeMissionId: string | null
  
  // Actions
  startMission: (id: string) => void
  completeObjective: (missionId: string, objectiveId: string) => void
  unlockMission: (id: string) => void
  resetMissions: () => void
}

const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'm1',
    title: 'Foundations of Infrastructure',
    description: 'Establish the core physical layer of your data center.',
    status: 'active',
    objectives: [
      { id: 'm1_obj1', label: 'Rack Installation', description: 'Deploy your first 42U Server Rack.', isComplete: false },
      { id: 'm1_obj2', label: 'Network Backbone', description: 'Install a 1U Leaf Switch in the rack.', isComplete: false },
      { id: 'm1_obj3', label: 'Compute Power', description: 'Add a 1U Compute Node to the rack.', isComplete: false },
    ],
    reward: 'Unlocked Storage Tier 1'
  },
  {
    id: 'm2',
    title: 'The Nervous System',
    description: 'Establish connectivity between your compute and network layers.',
    status: 'locked',
    objectives: [
      { id: 'm2_obj1', label: 'Patching Protocol', description: 'Connect the Compute Node to the Leaf Switch.', isComplete: false },
      { id: 'm2_obj2', label: 'Power Integrity', description: 'Ensure the rack has a PDU installed.', isComplete: false },
    ],
    reward: 'Unlocked Performance Metrics'
  },
  {
    id: 'm3',
    title: 'High Availability',
    description: 'Build a resilient stack capable of handling failures.',
    status: 'locked',
    objectives: [
      { id: 'm3_obj1', label: 'Storage Foundation', description: 'Deploy a SAN Controller and a Disk Shelf.', isComplete: false },
      { id: 'm3_obj2', label: 'Compute Cluster', description: 'Deploy at least 3 Compute Nodes in a single rack.', isComplete: false },
      { id: 'm3_obj3', label: 'Secure Perimeter', description: 'Install a Next-Gen Firewall (Security Appliance).', isComplete: false },
    ],
    reward: 'DCIM Certified Operator'
  }
]

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      missions: INITIAL_MISSIONS,
      activeMissionId: 'm1',

      startMission: (id) => set({ activeMissionId: id }),

      completeObjective: (missionId, objectiveId) => set(state => {
        const missionIndex = state.missions.findIndex(m => m.id === missionId)
        if (missionIndex === -1) return {}

        const mission = state.missions[missionIndex]
        const objectiveIndex = mission.objectives.findIndex(o => o.id === objectiveId)
        if (objectiveIndex === -1 || mission.objectives[objectiveIndex].isComplete) return {}

        // Create new objectives array
        const newObjectives = mission.objectives.map(obj => 
          obj.id === objectiveId ? { ...obj, isComplete: true } : obj
        )

        const allComplete = newObjectives.every(o => o.isComplete)
        const updatedMission = { 
          ...mission, 
          objectives: newObjectives, 
          status: (allComplete ? 'completed' : mission.status) as 'active' | 'completed' | 'locked'
        }

        const newMissions = [...state.missions]
        newMissions[missionIndex] = updatedMission

        // Auto-unlock next mission if current is completed
        if (allComplete && missionIndex < newMissions.length - 1) {
          const nextMission = newMissions[missionIndex + 1]
          if (nextMission.status === 'locked') {
            newMissions[missionIndex + 1] = { ...nextMission, status: 'active' }
          }
        }

        return { missions: newMissions }
      }),

      unlockMission: (id) => set(state => ({
        missions: state.missions.map(m => m.id === id ? { ...m, status: 'active' } : m)
      })),

      resetMissions: () => set({ missions: INITIAL_MISSIONS, activeMissionId: 'm1' })
    }),
    {
      name: 'infra-tycoon-missions-v2',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
