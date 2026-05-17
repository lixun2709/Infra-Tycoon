import { useEffect } from 'react'
import * as THREE from 'three'
import { useInfraStore } from '../store/useInfraStore'
import { useInput } from '../contexts/InputContext'

export function InteractionSystem() {
  const { subscribeToIntent } = useInput()
  const { setSelectedNode, placementMode, addNode, currentSiteId, setPlacementMode } = useInfraStore()

  useEffect(() => {
    const unsubscribe = subscribeToIntent((intent) => {
      switch (intent.type) {
        case 'SELECT_NODE':
          setSelectedNode(intent.payload.nodeId)
          break
        case 'DESELECT_NODE':
          setSelectedNode(null)
          break
        case 'PLACE_NODE':
          if (!placementMode) break
          addNode({
            id: crypto.randomUUID(),
            type: 'rack',
            position: new THREE.Vector3(intent.payload.position.x, intent.payload.position.y, intent.payload.position.z),
            name: `Rack-${Math.floor(Math.random() * 1000)}`,
            uHeight: 42,
            wattage: 0,
            btuOutput: 0,
            maxPowerKW: 5.0,
            currentPowerKW: 0,
            status: 'online',
            catalogKey: 'RACK_42U',
            ports: [],
            siteId: currentSiteId,
            services: [],
            systemState: 'running',
            bootProgress: 100,
            provisioningState: 'bootstrapped',
            installDate: useInfraStore.getState().simulationCycle,
            degradation: 0,
            temperature: 22
          })
          setPlacementMode(false, null)
          break
      }
    })

    return unsubscribe
  }, [subscribeToIntent, setSelectedNode, placementMode, addNode, currentSiteId, setPlacementMode])

  return null
}
