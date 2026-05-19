import type { InfraNode } from '../store/infraTypes'


/**
 * Rack-local vertical span [bottomU, topU] inclusive (1-based, bottom of rack = U1).
 */
function unitSpan(
  slotIndex: number,
  uHeight: number,
): { bottom: number; top: number } {
  return {
    bottom: slotIndex,
    top: slotIndex + uHeight - 1,
  }
}

function overlaps(
  a: { bottom: number; top: number },
  b: { bottom: number; top: number },
): boolean {
  return a.bottom <= b.top && b.bottom <= a.top
}

/**
 * Returns first rack (in array order) with a contiguous free run of `uHeight` U slots.
 */
export function findFirstEmptySlot(
  nodes: InfraNode[],
  uHeight: number,
  targetRackId?: string,
): { rackId: string; slotIndex: number } | null {
  if (uHeight < 1) return null

  const racks = nodes.filter((n) => n.type === 'rack')
  const searchedRacks = targetRackId ? racks.filter(r => r.id === targetRackId) : racks

  for (const rack of searchedRacks) {
    const rackU = rack.uHeight || 42
    if (uHeight > rackU) continue

    const mounted = nodes.filter(
      (n) => n.parentRackId === rack.id && n.slotIndex != null,
    )
    const spans = mounted.map((n) =>
      unitSpan(n.slotIndex!, n.uHeight),
    )

    for (let slot = 1; slot <= rackU - uHeight + 1; slot++) {
      const candidate = unitSpan(slot, uHeight)
      if (candidate.top > rackU) continue
      const clash = spans.some((s) => overlaps(candidate, s))
      if (!clash) return { rackId: rack.id, slotIndex: slot }
    }
  }
  return null
}
