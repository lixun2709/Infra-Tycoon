import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useInfraStore } from '../store/useInfraStore'

// Mock three
vi.mock('three', () => ({
  Vector3: class {
    x: number; y: number; z: number;
    constructor(x=0, y=0, z=0) { this.x = x; this.y = y; this.z = z; }
  }
}))

describe('Full Workflow Integration', () => {
  beforeEach(() => {
    useInfraStore.getState().resetCareer()
    useInfraStore.setState({
      sites: [{ id: 'site-1', name: 'DC1', isDisaster: false, region: 'EU', energySource: 'Grid', geoCoords: { lat: 0, lng: 0 } }],
      currentSiteId: 'site-1'
    })
  })

  it('should complete a full procurement to deployment cycle', () => {
    // 1. Initial State
    expect(useInfraStore.getState().cashBalance).toBe(10000)
    expect(useInfraStore.getState().nodes).toHaveLength(0)
    
    // 2. Add Rack
    useInfraStore.getState().addNode({
      id: 'rack-1',
      type: 'rack',
      siteId: 'site-1',
      position: { x: 0, y: 0, z: 0 } as any,
      name: 'Primary Rack',
      uHeight: 42,
      wattage: 0,
      btuOutput: 0,
      ports: [],
      services: []
    })
    
    // 3. Buy Hardware (Cart -> Checkout)
    useInfraStore.getState().addToCart('BLADE_CHASSIS_4U')
    useInfraStore.getState().addToCart('BLADE_SERVER')
    useInfraStore.getState().addToCart('COMPUTE_1U')
    
    expect(useInfraStore.getState().shoppingCart).toHaveLength(3)
    
    useInfraStore.getState().checkout()
    
    expect(useInfraStore.getState().cashBalance).toBeLessThan(10000)
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(3)
    
    // 4. Deploy from Staging
    // Deploy Chassis first
    useInfraStore.getState().placeCatalogHardware('BLADE_CHASSIS_4U', 'rack-1')
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(2)
    
    // Deploy Blade Server
    useInfraStore.getState().placeCatalogHardware('BLADE_SERVER', 'rack-1')
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(1)
    
    // Deploy Compute 1U
    useInfraStore.getState().placeCatalogHardware('COMPUTE_1U', 'rack-1')
    expect(useInfraStore.getState().deploymentQueue).toHaveLength(0)
    
    // 5. Verify Rack Content
    const finalNodes = useInfraStore.getState().nodes
    expect(finalNodes).toHaveLength(4) // 1 rack + 3 hardware
    expect(finalNodes.find(n => n.catalogKey === 'BLADE_SERVER')).toBeDefined()
  })
})
