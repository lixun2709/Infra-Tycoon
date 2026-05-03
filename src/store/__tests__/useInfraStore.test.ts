import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useInfraStore } from '../useInfraStore'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'

// Mock three
vi.mock('three', () => ({
  Vector3: class {
    x: number; y: number; z: number;
    constructor(x=0, y=0, z=0) { this.x = x; this.y = y; this.z = z; }
  }
}))

describe('useInfraStore', () => {
  beforeEach(() => {
    useInfraStore.getState().resetCareer()
    // Reset sites to default
    useInfraStore.setState({
      sites: [
        { id: 'site-1', name: 'Primary-DC', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } }
      ],
      currentSiteId: 'site-1'
    })
  })

  it('should add items to shopping cart', () => {
    const { addToCart } = useInfraStore.getState()
    addToCart('COMPUTE_1U')
    
    const state = useInfraStore.getState()
    expect(state.shoppingCart).toHaveLength(1)
    expect(state.shoppingCart[0].key).toBe('COMPUTE_1U')
    expect(state.shoppingCart[0].quantity).toBe(1)
    
    addToCart('COMPUTE_1U')
    expect(useInfraStore.getState().shoppingCart[0].quantity).toBe(2)
  })

  it('should checkout and move items to deployment queue', () => {
    const { addToCart, checkout } = useInfraStore.getState()
    addToCart('COMPUTE_1U')
    
    checkout()
    
    const state = useInfraStore.getState()
    expect(state.deploymentQueue).toContain('COMPUTE_1U')
    expect(state.shoppingCart).toHaveLength(0)
    expect(state.cashBalance).toBe(10000 - HARDWARE_CATALOG['COMPUTE_1U'].purchasePrice)
  })

  it('should handle blade server placement constraints', () => {
    const { placeCatalogHardware, addNode } = useInfraStore.getState()
    
    // Add a rack first
    addNode({
      id: 'rack-1',
      type: 'rack',
      siteId: 'site-1',
      position: { x: 0, y: 0, z: 0 } as any,
      name: 'Rack 1',
      uHeight: 42,
      wattage: 0,
      btuOutput: 0,
      ports: [],
      services: []
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
    const { addToCart, checkout, placeCatalogHardware, addNode } = useInfraStore.getState()
    
    // Setup
    addNode({ 
      id: 'rack-1', 
      type: 'rack', 
      siteId: 'site-1', 
      position: { x: 0, y: 0, z: 0 } as any, 
      name: 'Rack 1', 
      uHeight: 42, 
      wattage: 0, 
      btuOutput: 0,
      ports: [],
      services: []
    })
    addToCart('COMPUTE_1U')
    addToCart('COMPUTE_1U')
    checkout()
    
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(2)
    
    // Place one
    placeCatalogHardware('COMPUTE_1U', 'rack-1')
    
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(1)
  })
})
