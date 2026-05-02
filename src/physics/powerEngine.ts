import { useInfraStore } from '../store/useInfraStore'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function calculateRackPower(rackId: string) {
  const { nodes } = useInfraStore.getState()
  const rack = nodes.find((n) => n.id === rackId)
  if (!rack || rack.type !== 'rack') return

  const totalW = nodes
    .filter((n) => n.parentRackId === rackId)
    .reduce((sum, n) => sum + (n.wattage ?? 0), 0)

  const currentPowerKW = totalW / 1000
  const maxPowerKW = rack.maxPowerKW ?? 5.0
  const status = currentPowerKW > maxPowerKW ? 'power_overload' : 'online'

  if (rack.status !== 'power_overload' && status === 'power_overload') {
     useInfraStore.getState().pushAlert('critical', `Rack ${rack.name || rack.id.slice(0,6)} is experiencing a POWER OVERLOAD! (${currentPowerKW.toFixed(1)}kW)`, rackId)
  }

  useInfraStore.setState((state) => ({
    nodes: state.nodes.map((n) =>
      n.id === rackId
        ? {
            ...n,
            maxPowerKW,
            currentPowerKW: round1(currentPowerKW),
            status,
          }
        : n,
    ),
  }))
}

export function recalculateRoomStats() {
  const { nodes } = useInfraStore.getState()
  const totalW = nodes
    .filter((n) => n.type !== 'rack')
    .reduce((sum, n) => sum + (n.wattage ?? 0), 0)
  const totalPowerKW = totalW / 1000

  const totalRoomBTU = nodes
    .filter((n) => n.type !== 'rack')
    .reduce((sum, n) => sum + (n.btuOutput ?? 0), 0)

  const { totalRoomBTU: prevBTU } = useInfraStore.getState()
  if (prevBTU <= 50000 && totalRoomBTU > 50000) {
     useInfraStore.getState().pushAlert('warning', `High Temperature Warning! Room thermal capacity exceeded 50,000 BTU/hr.`)
  } else if (prevBTU > 50000 && totalRoomBTU <= 50000) {
     useInfraStore.getState().pushAlert('info', `Room temperature stabilized.`)
  }

  const overloadedRackCount = nodes.filter(
    (n) => n.type === 'rack' && n.status === 'power_overload',
  ).length

  useInfraStore.setState({
    totalPowerKW: round1(totalPowerKW),
    totalRoomBTU: Math.round(totalRoomBTU),
    overloadedRackCount,
  })
}

