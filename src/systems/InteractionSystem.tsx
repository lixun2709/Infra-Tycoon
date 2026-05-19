import { useEffect } from 'react'
import * as THREE from 'three'
import { useInfraStore } from '../store/useInfraStore'
import { useInput } from '../contexts/InputContext'
import { InputProcessor } from './interaction/InputProcessor'
import { InteractionController } from '../components/world/renderers/InteractionController'

export function InteractionSystem() {
  const { subscribeToIntent } = useInput()

  useEffect(() => {
    const unsubscribe = subscribeToIntent((intent) => {
      switch (intent.type) {
        case 'SELECT_NODE':
          InputProcessor.getInstance().enqueueIntent({
            type: 'SELECT_NODE',
            payload: { nodeId: intent.payload.nodeId, nodeType: 'NODE' }
          })
          break
        case 'DESELECT_NODE':
          InputProcessor.getInstance().enqueueIntent({ type: 'DESELECT_NODE' })
          break
        case 'PLACE_NODE': {
          const store = useInfraStore.getState()
          if (!store.placementMode) break
          
          InputProcessor.getInstance().enqueueIntent({
            type: 'PLACE_HARDWARE',
            payload: { key: store.pendingRackType || 'RACK_42U', rackId: 'rack-direct' }
          })

          store.addNode({
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
            siteId: store.currentSiteId,
            services: [],
            systemState: 'running',
            bootProgress: 100,
            provisioningState: 'bootstrapped',
            installDate: Math.floor(store.realTimePlayedSeconds),
            degradation: 0,
            temperature: 22
          })
          store.setPlacementMode(false, null)
          break
        }
      }
    })

    return unsubscribe
  }, [subscribeToIntent])

  return <InteractionController />
}

