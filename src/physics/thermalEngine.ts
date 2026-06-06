/* eslint-disable @typescript-eslint/no-explicit-any */
import { useInfraStore } from '../store/useInfraStore'
import { HARDWARE_CATALOG } from './hardwareLibrary'

/**
 * ThermalManager - Advanced Datacenter Thermodynamics
 * Handles conduction (within racks) and convection (to room ambient).
 */
export class ThermalManager {
  private static CONDUCTION_COEFFICIENT = 0.05
  private static CONVECTION_COEFFICIENT = 0.02
  private static BASE_AMBIENT_TEMP = 22.0
  private static DEFAULT_CRITICAL = 85.0
  private static DEFAULT_THROTTLE = 75.0

  public static processTick(dt: number) {
    const { nodes, currentSiteId } = useInfraStore.getState()
    const updatedNodes = [...nodes]
    
    // 1. Calculate Cooling Impact
    const coolingUnits = nodes.filter((n: any) => n.type === 'cooling' && n.siteId === currentSiteId && n.systemState === 'running')
    const totalCoolingBTU = coolingUnits.reduce((sum: any, n: any) => sum + Math.abs(n.btuOutput || 0), 0)
    
    // Ambient temp drops based on cooling capacity (simplified)
    const ambientTemp = Math.max(18.0, this.BASE_AMBIENT_TEMP - (totalCoolingBTU / 100000) * 4)
    
    // 2. Process per-node heat dynamics
    updatedNodes.forEach((node, index) => {
      if (node.type === 'rack') return
      
      const spec = node.catalogKey ? (HARDWARE_CATALOG[node.catalogKey] as import('./hardwareLibrary').HardwareCatalogSpec) : null
      const isRunning = node.systemState === 'running'
      const isBooting = node.systemState === 'booting'
      
      // Heat generation
      const efficiency = spec?.heatEfficiency ?? 0.8
      const baseHeat = isRunning ? (node.wattage || 0) * 0.001 * efficiency : 
                       isBooting ? (node.wattage || 0) * 0.0005 * efficiency : 0.01
      
      const currentTemp = node.temperature ?? ambientTemp
      const convection = (currentTemp - ambientTemp) * this.CONVECTION_COEFFICIENT * dt
      
      const nextTemp = currentTemp + (baseHeat * dt) - convection
      
      const critical = spec?.maxOperatingTemp ?? this.DEFAULT_CRITICAL
      const throttle = spec?.throttleTemp ?? this.DEFAULT_THROTTLE

      let finalNode = node
      if (nextTemp > critical) {
        if (node.systemState !== 'off') {
          useInfraStore.getState().pushAlert('critical', `OVERHEAT SHUTDOWN: ${node.name || node.id.slice(0,6)} reached ${nextTemp.toFixed(1)}°C!`, node.id)
          finalNode = { ...node, systemState: 'off', temperature: nextTemp, bootProgress: 0 }
        }
      } else if (nextTemp > throttle) {
        if (!node.isThrottled) {
          useInfraStore.getState().pushAlert('warning', `THERMAL THROTTLING: ${node.name || node.id.slice(0,6)} is at ${nextTemp.toFixed(1)}°C.`, node.id)
          finalNode = { ...node, isThrottled: true, temperature: nextTemp }
        }
      } else {
        if (node.isThrottled && nextTemp < throttle - 5) {
          finalNode = { ...node, isThrottled: false, temperature: nextTemp }
        }
      }
      
      updatedNodes[index] = { ...finalNode, temperature: Math.max(18.0, nextTemp) }
    })

    // 3. Conduction between adjacent nodes in the same rack
    const racks = updatedNodes.filter(n => n.type === 'rack')
    racks.forEach(rack => {
      const rackNodes = updatedNodes.filter(n => n.parentRackId === rack.id).sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0))
      
      for (let i = 0; i < rackNodes.length - 1; i++) {
        const nodeA = rackNodes[i]
        const nodeB = rackNodes[i+1]
        if (!nodeA || !nodeB) continue
        
        const tempA = nodeA.temperature || ambientTemp
        const tempB = nodeB.temperature || ambientTemp
        
        const diff = (tempA - tempB) * this.CONDUCTION_COEFFICIENT * dt
        
        const idxA = updatedNodes.findIndex(n => n.id === nodeA.id)
        const idxB = updatedNodes.findIndex(n => n.id === nodeB.id)
        
        if (idxA !== -1 && idxB !== -1) {
          const itemA = updatedNodes[idxA]
          const itemB = updatedNodes[idxB]
          if (itemA && itemB) {
            updatedNodes[idxA] = { ...itemA, temperature: (itemA.temperature || 0) - diff }
            updatedNodes[idxB] = { ...itemB, temperature: (itemB.temperature || 0) + diff }
          }
        }
      }
    })

    // 4. Update store
    useInfraStore.setState({ nodes: updatedNodes })
  }
}

