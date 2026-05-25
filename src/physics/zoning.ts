export interface PredefinedSlot {
  x: number
  z: number
  rowId: string
  aisleType: 'cold' | 'hot'
}

export interface PredefinedRow {
  id: string
  z: number
  aisleType: 'cold' | 'hot'
}

export const PREDEFINED_ROWS: PredefinedRow[] = [
  { id: 'row-1', z: -6, aisleType: 'cold' },
  { id: 'row-2', z: -2, aisleType: 'hot' },
  { id: 'row-3', z: 2, aisleType: 'cold' },
  { id: 'row-4', z: 6, aisleType: 'hot' }
]

export const PREDEFINED_SLOTS: PredefinedSlot[] = (() => {
  const slots: PredefinedSlot[] = []
  for (const row of PREDEFINED_ROWS) {
    for (let x = -8; x <= 8; x++) {
      slots.push({
        x,
        z: row.z,
        rowId: row.id,
        aisleType: row.aisleType
      })
    }
  }
  return slots
})()

export interface DatacenterHall {
  id: string
  x: number
  z: number
}

export function syncZoningWithStore(
  rowsCount: number, 
  columnsCount: number, 
  halls: DatacenterHall[] = [{ id: 'hall-0-0', x: 0, z: 0 }]
) {
  const nextRows: PredefinedRow[] = []
  const nextSlots: PredefinedSlot[] = []

  halls.forEach((hall) => {
    const offsetX = hall.x * 30
    const offsetZ = hall.z * 30

    const hallRows: PredefinedRow[] = []
    for (let i = 0; i < rowsCount; i++) {
      const z = offsetZ - 6 + i * 4
      hallRows.push({
        id: `${hall.id}-row-${i + 1}`,
        z,
        aisleType: i % 2 === 0 ? 'cold' : 'hot'
      })
    }

    const half = Math.floor(columnsCount / 2)
    const startX = -half
    const endX = half

    hallRows.forEach(row => {
      nextRows.push(row)
      for (let x = startX; x <= endX; x++) {
        nextSlots.push({
          x: offsetX + x,
          z: row.z,
          rowId: row.id,
          aisleType: row.aisleType
        })
      }
    })
  })

  // Mutate in-place so all imported references remain active
  PREDEFINED_ROWS.length = 0
  PREDEFINED_ROWS.push(...nextRows)

  PREDEFINED_SLOTS.length = 0
  PREDEFINED_SLOTS.push(...nextSlots)
}

/**
 * Finds the nearest predefined slot to a given spatial coordinate (x, z).
 * Returns null if the nearest slot is further than the max distance threshold.
 */
export function findNearestSlot(x: number, z: number, maxDistance = 2.0): PredefinedSlot | null {
  let nearestSlot: PredefinedSlot | null = null
  let minDistance = Infinity

  for (const slot of PREDEFINED_SLOTS) {
    const dx = x - slot.x
    const dz = z - slot.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < minDistance && dist <= maxDistance) {
      minDistance = dist
      nearestSlot = slot
    }
  }

  return nearestSlot
}
