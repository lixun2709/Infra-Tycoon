import type { InfraNode } from '../store/infraTypes'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function calculateRackPower(nodes: InfraNode[], rackId: string) {
  const rack = nodes.find((n) => n.id === rackId)
  if (!rack || rack.type !== 'rack') return 0

  const rackNodes = nodes.filter((n) => n.parentRackId === rackId)
  const totalW = rackNodes.reduce((sum, n) => {
    const baseW = n.systemState === 'running' ? (n.wattage ?? 0) : 
                 n.systemState === 'booting' ? (n.wattage ?? 0) * 0.5 : 10
    return sum + baseW
  }, 0)

  return round1(totalW / 1000)
}

export function recalculateRoomStats() {
  // Logic to recalculate room-wide thermal and power metrics
  // In a real implementation, this would aggregate from the store
}
