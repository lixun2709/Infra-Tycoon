/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'

export type CameraMode = 'GLOBAL_MAP' | 'SITE_DEFAULT' | 'INSPECT' | 'MANUAL_FREE'

export interface CameraSlice {
  cameraMode: CameraMode
  cameraTarget: { x: number; y: number; z: number }
  cameraFocusNodeId: string | null
  cameraFocusPosition: { x: number; y: number; z: number } | null
  spectatorPositions: Record<string, { position: [number, number, number]; target: [number, number, number] }>
  
  setCameraMode: (mode: CameraMode) => void
  focusOnNode: (nodeId: string | null) => void
  focusOnPosition: (pos: { x: number; y: number; z: number } | null) => void
  resetCamera: () => void
  syncSpectatorCamera: (playerId: string, position: [number, number, number], target: [number, number, number]) => void
}

export const createCameraSlice: StateCreator<InfraState, [], [], CameraSlice> = (set) => ({
  cameraMode: 'SITE_DEFAULT',
  cameraTarget: { x: 0, y: 0, z: 0 },
  cameraFocusNodeId: null,
  cameraFocusPosition: null,
  spectatorPositions: {},

  setCameraMode: (mode) => set({ cameraMode: mode }),

  focusOnNode: (nodeId) => set({
    cameraFocusNodeId: nodeId,
    cameraFocusPosition: null, // Clear custom position focus when a node is selected
    cameraMode: nodeId ? 'INSPECT' : 'SITE_DEFAULT',
    selectedNodeId: nodeId // Sync with selectedNodeId
  }),

  focusOnPosition: (pos) => set({
    cameraFocusPosition: pos,
    cameraFocusNodeId: null, // Clear node selection to prioritize position focus
    selectedNodeId: null,
    cameraMode: pos ? 'INSPECT' : 'SITE_DEFAULT'
  }),

  resetCamera: () => set({
    cameraMode: 'SITE_DEFAULT',
    cameraFocusNodeId: null,
    cameraFocusPosition: null,
    cameraTarget: { x: 0, y: 0, z: 0 }
  }),

  syncSpectatorCamera: (playerId, position, target) => set((state: any) => ({
    spectatorPositions: {
      ...state.spectatorPositions,
      [playerId]: { position, target }
    }
  }))
})

