import { useEffect } from 'react'
import * as THREE from 'three'
import { useInfraStore } from '../store/useInfraStore'
import { useInput } from '../contexts/InputContext'
import { InputProcessor } from './interaction/InputProcessor'
import { InteractionController } from '../components/world/renderers/InteractionController'
import { HARDWARE_CATALOG, type HardwareCatalogKey } from '../physics/hardwareLibrary'

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
          
          const rackKey = (store.pendingRackType as HardwareCatalogKey) || 'RACK_42U'
          const spec: import('../physics/hardwareLibrary').HardwareCatalogSpec = HARDWARE_CATALOG[rackKey]
          
          if (!spec || spec.type !== 'rack') break

          if (store.balance < spec.purchasePrice) {
            store.pushAlert('warning', `Insufficient funds for ${spec.name}`)
            store.setPlacementMode(false, null)
            break
          }

          useInfraStore.setState((s: any) => ({ balance: s.balance - spec.purchasePrice }))

          InputProcessor.getInstance().enqueueIntent({
            type: 'PLACE_HARDWARE',
            payload: { key: rackKey, rackId: 'rack-direct' }
          })

          store.addNode({
            id: crypto.randomUUID(),
            type: 'rack',
            position: new THREE.Vector3(intent.payload.position.x, intent.payload.position.y, intent.payload.position.z),
            name: `Rack-${Math.floor(Math.random() * 1000)}`,
            uHeight: spec.uHeight,
            wattage: spec.wattage || 0,
            btuOutput: spec.btuOutput || 0,
            maxPowerKW: spec.maxPowerKW || 5.0,
            maxWeightKG: spec.maxWeightKG || 1000,
            currentPowerKW: 0,
            status: 'online',
            catalogKey: rackKey,
            ports: [],
            siteId: store.currentSiteId,
            services: [],
            systemState: 'running',
            bootProgress: 100,
            provisioningState: 'bootstrapped',
            installDate: Math.floor(store.realTimePlayedSeconds),
            degradation: 0,
            temperature: 22,
            heatEfficiency: spec.heatEfficiency
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

