import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useInfraStore } from '../useInfraStore'
import { Vector3 } from 'three'

// Mock three
vi.mock('three', () => ({
  Vector3: class {
    x: number; y: number; z: number;
    constructor(x=0, y=0, z=0) { this.x = x; this.y = y; this.z = z; }
  }
}))

describe('useInfraStore v2.0', () => {
  beforeEach(() => {
    useInfraStore.getState().resetState()
    // Reset sites to default
    useInfraStore.setState({
      sites: [
        { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } }
      ],
      currentSiteId: 'site-1'
    })
  })

  it('should stage items to deployment queue', () => {
    useInfraStore.setState(state => ({
      deploymentQueue: [...state.deploymentQueue, 'COMPUTE_1U']
    }))
    
    const state = useInfraStore.getState()
    expect(state.deploymentQueue).toHaveLength(1)
    expect(state.deploymentQueue[0]).toBe('COMPUTE_1U')
    
    useInfraStore.setState(state => ({
      deploymentQueue: [...state.deploymentQueue, 'COMPUTE_1U']
    }))
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(2)
  })

  it('should handle blade server placement constraints', () => {
    const { placeCatalogHardware, addNode } = useInfraStore.getState()
    
    // Add a rack first
    addNode({
      id: 'rack-1',
      type: 'rack',
      siteId: 'site-1',
      position: new Vector3(0, 0, 0),
      name: 'Rack 1',
      uHeight: 42,
      wattage: 0,
      btuOutput: 0,
      ports: [],
      services: [],
      systemState: 'running',
      bootProgress: 100,
      provisioningState: 'bootstrapped',
      installDate: 0,
      degradation: 0
    })

    // Try to place blade server without chassis - should fail
    const success = placeCatalogHardware('BLADE_SERVER', 'rack-1')
    expect(success).toBe(false)
    
    // Add chassis
    const chassisSuccess = placeCatalogHardware('BLADE_CHASSIS_4U', 'rack-1')
    expect(chassisSuccess).toBe(true)
    
    // Now place blade server - should succeed
    const success2 = placeCatalogHardware('BLADE_SERVER', 'rack-1')
    expect(success2).toBe(true)
  })

  it('should remove items from deployment queue after placement', () => {
    const { placeCatalogHardware, addNode } = useInfraStore.getState()
    
    // Setup
    addNode({ 
      id: 'rack-1', 
      type: 'rack', 
      siteId: 'site-1', 
      position: new Vector3(0, 0, 0), 
      name: 'Rack 1', 
      uHeight: 42, 
      wattage: 0, 
      btuOutput: 0,
      ports: [],
      services: [],
      systemState: 'running',
      bootProgress: 100,
      provisioningState: 'bootstrapped',
      installDate: 0,
      degradation: 0
    })
    
    useInfraStore.setState({ deploymentQueue: ['COMPUTE_1U', 'COMPUTE_1U'] })
    
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(2)
    
    // Place one
    placeCatalogHardware('COMPUTE_1U', 'rack-1')
    
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(1)
  })
})
