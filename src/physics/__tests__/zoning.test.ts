import { describe, it, expect } from 'vitest'
import { PREDEFINED_SLOTS, PREDEFINED_ROWS, findNearestSlot } from '../zoning'

describe('Predefined DCIM Slot Deployment System', () => {
  it('should compile exactly 68 predefined rack slot anchors across 4 rows', () => {
    expect(PREDEFINED_ROWS.length).toBe(4)
    expect(PREDEFINED_SLOTS.length).toBe(68) // 17 slots per row * 4 rows
  })

  it('should contain coordinates aligned with the 30x30 floor grid boundaries', () => {
    for (const slot of PREDEFINED_SLOTS) {
      expect(slot.x).toBeGreaterThanOrEqual(-8)
      expect(slot.x).toBeLessThanOrEqual(8)
      expect(slot.z).oneOf([-6, -2, 2, 6])
    }
  })

  it('should snap coordinates to the closest predefined slot within range', () => {
    // A point at x = 1.2, z = 2.1 should snap to the slot at x = 1, z = 2 (Row 3)
    const snapped = findNearestSlot(1.2, 2.1, 1.5)
    expect(snapped).not.toBeNull()
    expect(snapped!.x).toBe(1)
    expect(snapped!.z).toBe(2)
    expect(snapped!.rowId).toBe('row-3')
    expect(snapped!.aisleType).toBe('cold')
  })

  it('should reject snapping if the coordinate is beyond the max distance threshold', () => {
    // A point at x = 0, z = 0 is far from row-2 (z=-2) and row-3 (z=2). Distance = 2.0.
    // If we specify maxDistance = 1.0, it should return null.
    const snapped = findNearestSlot(0, 0, 1.0)
    expect(snapped).toBeNull()
  })
})
