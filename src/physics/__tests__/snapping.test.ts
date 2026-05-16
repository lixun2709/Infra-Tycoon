import { describe, it, expect } from 'vitest'
import { findFirstEmptySlot } from '../snapping'
import type { InfraNode } from '../../store/infraTypes'

describe('snapping logic', () => {
  const mockNodes: Partial<InfraNode>[] = [
    { id: 'rack-1', type: 'rack' }
  ]

  it('should find the first empty slot for a 1U item', () => {
    const result = findFirstEmptySlot(mockNodes as InfraNode[], 1)
    expect(result).toEqual({ rackId: 'rack-1', slotIndex: 1 })
  })

  it('should find the next available slot when one is occupied', () => {
    const nodesWithOccupied: Partial<InfraNode>[] = [
      ...mockNodes,
      { id: 'node-1', type: 'compute', parentRackId: 'rack-1', slotIndex: 1, uHeight: 1 }
    ]
    const result = findFirstEmptySlot(nodesWithOccupied as InfraNode[], 1)
    expect(result).toEqual({ rackId: 'rack-1', slotIndex: 2 })
  })

  it('should correctly handle multi-U items', () => {
    const nodesWithOccupied: Partial<InfraNode>[] = [
      ...mockNodes,
      { id: 'node-1', type: 'compute', parentRackId: 'rack-1', slotIndex: 1, uHeight: 2 } // Occupies U1, U2
    ]
    const result = findFirstEmptySlot(nodesWithOccupied as InfraNode[], 2) // Needs U3, U4
    expect(result).toEqual({ rackId: 'rack-1', slotIndex: 3 })
  })

  it('should return null if not enough space remains', () => {
    const nodesWithFullRack: Partial<InfraNode>[] = [
      ...mockNodes,
      { id: 'node-1', type: 'compute', parentRackId: 'rack-1', slotIndex: 1, uHeight: 40 }
    ]
    const result = findFirstEmptySlot(nodesWithFullRack as InfraNode[], 5) // 40 + 5 = 45 > 42
    expect(result).toBeNull()
  })
})
