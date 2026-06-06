import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'

export type InteractionMode = 'IDLE' | 'SELECTING' | 'PLACING' | 'WIRING' | 'SPECTATING'

export interface OperatorGesture {
  operatorId: string
  mode: string
  cursor: { x: number; y: number }
  selectedNodeId: string | null
}

export interface InteractionSlice {
  interactionMode: InteractionMode
  activeHoverNodeId: string | null
  activeHoverType: 'RACK' | 'NODE' | 'FLOOR' | null
  activeSelectionPath: string[]
  isDragging: boolean
  dragStartPos: { x: number; y: number; z: number } | null
  operatorGestures: Record<string, OperatorGesture>
  interactionLogs: string[]

  setInteractionMode: (mode: InteractionMode) => void
  setHoverState: (nodeId: string | null, type: 'RACK' | 'NODE' | 'FLOOR' | null) => void
  updateOperatorGesture: (operatorId: string, gesture: Partial<Omit<OperatorGesture, 'operatorId'>>) => void
  clearOperatorGesture: (operatorId: string) => void
  logInteractionEvent: (event: string) => void
}

export const createInteractionSlice: StateCreator<InfraState, [], [], InteractionSlice> = (set) => ({
  interactionMode: 'IDLE',
  activeHoverNodeId: null,
  activeHoverType: null,
  activeSelectionPath: [],
  isDragging: false,
  dragStartPos: null,
  operatorGestures: {},
  interactionLogs: [],

  setInteractionMode: (mode) => set({ interactionMode: mode }),

  setHoverState: (nodeId, type) => set({
    activeHoverNodeId: nodeId,
    activeHoverType: type
  }),

  updateOperatorGesture: (operatorId, gesture) => set((state: any) => ({
    operatorGestures: {
      ...state.operatorGestures,
      [operatorId]: {
        ...(state.operatorGestures[operatorId] || {
          operatorId,
          mode: 'IDLE',
          cursor: { x: 0, y: 0 },
          selectedNodeId: null
        }),
        ...gesture
      }
    }
  })),

  clearOperatorGesture: (operatorId) => set((state: any) => {
    const updated = { ...state.operatorGestures }
    delete updated[operatorId]
    return { operatorGestures: updated }
  }),

  logInteractionEvent: (event) => set((state: any) => {
    const newLogs = [...state.interactionLogs, event]
    if (newLogs.length > 200) {
      newLogs.shift()
    }
    return { interactionLogs: newLogs }
  })
})
