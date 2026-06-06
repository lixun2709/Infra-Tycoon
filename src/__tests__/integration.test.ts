import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { useInfraStore } from '../store/useInfraStore'
import type { InfraNode } from '../store/infraTypes'

describe('End-to-End Infrastructure Lifecycle', () => {
  it('should complete a full hardware procurement cycle', () => {
    const { addNode, placeCatalogHardware } = useInfraStore.getState()
    
    // 1. Initial State
    expect(useInfraStore.getState().balance).toBeGreaterThan(0)
    
    // 2. Add Rack
    addNode({
      id: 'rack-test',
      type: 'rack',
      siteId: 'site-1',
      position: new THREE.Vector3(0, 0, 0),
      name: 'Test Rack',
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
    } as InfraNode)
    
    // 3. Procure Compute
    const success = placeCatalogHardware('COMPUTE_1U', 'rack-test')
    expect(success).toBe(true)
    
    const nodes = useInfraStore.getState().nodes
    const compute = nodes.find((n: any) => n.type === 'compute')
    expect(compute).toBeDefined()
    expect(compute?.parentRackId).toBe('rack-test')
  })
})
