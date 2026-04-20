import { Vector3 } from 'three'
import { create } from 'zustand'

export type InfraNodeType = 'rack' | string

export type InfraNode = {
  id: string
  type: InfraNodeType
  position: Vector3
  name: string
}

type InfraState = {
  nodes: InfraNode[]
  addNode: (node: InfraNode) => void
}

export const useInfraStore = create<InfraState>((set) => ({
  nodes: [],
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),
}))
