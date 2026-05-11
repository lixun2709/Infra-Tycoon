import { useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import { useMissionStore } from '../../store/useMissionStore'

export const MissionLogic: React.FC = () => {
  const nodes = useInfraStore(s => s.nodes)
  const connections = useInfraStore(s => s.connections)
  const { activeMissionId, completeObjective } = useMissionStore()

  useEffect(() => {
    if (!activeMissionId) return

    // Mission 1: Foundations of Infrastructure
    if (activeMissionId === 'm1') {
      // Obj 1: Rack Installation
      const hasRack = nodes.some(n => n.type === 'rack')
      if (hasRack) completeObjective('m1', 'm1_obj1')

      // Obj 2: Network Backbone (Leaf Switch in a rack)
      const hasSwitchInRack = nodes.some(n => n.catalogKey === 'LEAF_SWITCH_1U' && n.parentRackId)
      if (hasSwitchInRack) completeObjective('m1', 'm1_obj2')

      // Obj 3: Compute Power (Compute Node in a rack)
      const hasComputeInRack = nodes.some(n => n.type === 'compute' && n.parentRackId)
      if (hasComputeInRack) completeObjective('m1', 'm1_obj3')
    }

    // Mission 2: The Nervous System
    if (activeMissionId === 'm2') {
      // Obj 1: Patching Protocol (Compute to Network connection)
      const hasPatch = connections.some(conn => {
        const startNode = nodes.find(n => n.id === conn.startNodeId)
        const endNode = nodes.find(n => n.id === conn.endNodeId)
        if (!startNode || !endNode) return false
        return (startNode.type === 'compute' && endNode.type === 'network') ||
               (startNode.type === 'network' && endNode.type === 'compute')
      })
      if (hasPatch) completeObjective('m2', 'm2_obj1')

      // Obj 2: Power Integrity (PDU installed in a rack)
      const hasPduInRack = nodes.some(n => n.catalogKey === 'HIGH_DENSITY_PDU_1U' && n.parentRackId)
      if (hasPduInRack) completeObjective('m2', 'm2_obj2')
    }
    
    // Mission 3: High Availability
    if (activeMissionId === 'm3') {
      // Obj 1: Storage Foundation
      const hasSan = nodes.some(n => n.catalogKey === 'SAN_CONTROLLER_2U')
      const hasShelf = nodes.some(n => n.catalogKey === 'DISK_SHELF_2U')
      if (hasSan && hasShelf) completeObjective('m3', 'm3_obj1')

      // Obj 2: Compute Cluster (3 compute nodes in same rack)
      const racks = nodes.filter(n => n.type === 'rack')
      const clusterReady = racks.some(rack => {
        const computeInRack = nodes.filter(n => n.parentRackId === rack.id && n.type === 'compute')
        return computeInRack.length >= 3
      })
      if (clusterReady) completeObjective('m3', 'm3_obj2')

      // Obj 3: Secure Perimeter
      const hasSecurity = nodes.some(n => n.type === 'security')
      if (hasSecurity) completeObjective('m3', 'm3_obj3')
    }
  }, [nodes, connections, activeMissionId, completeObjective])

  return null
}
