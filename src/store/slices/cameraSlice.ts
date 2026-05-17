import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'

export type CameraMode = 'GLOBAL_MAP' | 'SITE_DEFAULT' | 'INSPECT' | 'MANUAL_FREE'

export interface CameraSlice {
  cameraMode: CameraMode
  cameraTarget: { x: number; y: number; z: number }
  cameraFocusNodeId: string | null
  spectatorPositions: Record<string, { position: [number, number, number]; target: [number, number, number] }>
  
  setCameraMode: (mode: CameraMode) => void
  focusOnNode: (nodeId: string | null) => void
  resetCamera: () => void
  syncSpectatorCamera: (playerId: string, position: [number, number, number], target: [number, number, number]) => void
}

export const createCameraSlice: StateCreator<InfraState, [], [], CameraSlice> = (set) => ({
  cameraMode: 'SITE_DEFAULT',
  cameraTarget: { x: 0, y: 0, z: 0 },
  cameraFocusNodeId: null,
  spectatorPositions: {},

  setCameraMode: (mode) => set({ cameraMode: mode }),

  focusOnNode: (nodeId) => set({
    cameraFocusNodeId: nodeId,
    cameraMode: nodeId ? 'INSPECT' : 'SITE_DEFAULT',
    selectedNodeId: nodeId // Sync with selectedNodeId
  }),

  resetCamera: () => set({
    cameraMode: 'SITE_DEFAULT',
    cameraFocusNodeId: null,
    cameraTarget: { x: 0, y: 0, z: 0 }
  }),

  syncSpectatorCamera: (playerId, position, target) => set((state) => ({
    spectatorPositions: {
      ...state.spectatorPositions,
      [playerId]: { position, target }
    }
  }))
})
