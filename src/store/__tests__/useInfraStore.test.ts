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
        { id: 'site-1', name: 'Primary-DC', type: 'core', isDisaster: false, region: 'EU-West', energySource: 'Renewable', geoCoords: { lat: 52.36, lng: 4.89 } }
      ],
      currentSiteId: 'site-1'
    })
  })

  it('should stage items to deployment queue', () => {
    useInfraStore.setState((state: any) => ({
      deploymentQueue: [...state.deploymentQueue, 'COMPUTE_1U']
    }))
    
    const state = useInfraStore.getState()
    expect(state.deploymentQueue).toHaveLength(1)
    expect(state.deploymentQueue[0]).toBe('COMPUTE_1U')
    
    useInfraStore.setState((state: any) => ({
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

  it('should suppress similar recurring alerts for 10 minutes once acknowledged', async () => {
    useInfraStore.setState({ alerts: [] })
    const { pushAlert, acknowledgeAlert } = useInfraStore.getState()
    const { clearAlertSuppressions } = await import('../slices/uiSlice')
    clearAlertSuppressions()

    // 1. Push initial critical alert
    pushAlert('critical', 'Site site-1 power draw saturation threat: 36.2kW / 30.0kW', 'site-1')
    
    let alerts = useInfraStore.getState().alerts
    expect(alerts).toHaveLength(1)
    const firstAlert = alerts[0]
    if (!firstAlert) throw new Error('Alert not found')
    expect(firstAlert.message).toBe('Site site-1 power draw saturation threat: 36.2kW / 30.0kW')
    expect(firstAlert.isAcknowledged).toBe(false)

    // 2. Acknowledge this alert
    const firstAlertId = firstAlert.id
    acknowledgeAlert(firstAlertId)
    
    alerts = useInfraStore.getState().alerts
    const firstAlertAcked = alerts[0]
    if (!firstAlertAcked) throw new Error('Alert not found')
    expect(firstAlertAcked.isAcknowledged).toBe(true)

    // 3. Try to push a similar alert (minor numerical variation) - should be suppressed
    pushAlert('critical', 'Site site-1 power draw saturation threat: 38.5kW / 30.0kW', 'site-1')
    
    alerts = useInfraStore.getState().alerts
    // Length should remain 1 because the second alert was suppressed
    expect(alerts).toHaveLength(1)

    // 4. Try to push a completely different alert - should NOT be suppressed
    pushAlert('warning', 'Low relative humidity in room site-1 (18.5% RH)', 'site-1')
    
    alerts = useInfraStore.getState().alerts
    expect(alerts).toHaveLength(2)
    const secondAlert = alerts[0]
    if (!secondAlert) throw new Error('Alert not found')
    expect(secondAlert.message).toBe('Low relative humidity in room site-1 (18.5% RH)')
    expect(secondAlert.isAcknowledged).toBe(false)
  })
})
