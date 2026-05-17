import { System } from '../System'
import type { ThermalComponent, PowerComponent, TransformComponent } from '../types'

/**
 * ThermalSystem
 * ECS implementation of thermodynamic simulation.
 * Handles conduction, convection, and thermal safety logic.
 */
export class ThermalSystem extends System {
  private static CONDUCTION_COEFFICIENT = 0.05
  private static CONVECTION_COEFFICIENT = 0.02
  private static BASE_AMBIENT_TEMP = 22.0
  private static DEFAULT_CRITICAL = 85.0
  private static DEFAULT_THROTTLE = 75.0

  public update(dt: number) {
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')

    // 1. Calculate Site Ambient (Simplified ECS version)
    // In a full implementation, we'd query for 'cooling' entities
    const ambientTemp = ThermalSystem.BASE_AMBIENT_TEMP // Base for now

    // 2. Process per-entity heat dynamics
    const entities = this.world.getEntitiesWith(['thermal', 'transform'])
    
    entities.forEach(id => {
      const thermal = thermalMap.get(id)!
      const power = powerMap.get(id)
      const transform = transformMap.get(id)!

      if (transform.type === 'rack') return

      // Heat generation based on power load
      const isRunning = power?.isPowered ?? false
      const efficiency = power?.efficiency ?? 0.8
      
      const baseHeat = isRunning ? (power?.wattage ?? 0) * 0.001 * (1 - efficiency) : 0.01
      
      const currentTemp = thermal.temperature
      const convection = (currentTemp - ambientTemp) * ThermalSystem.CONVECTION_COEFFICIENT * dt
      
      const nextTemp = currentTemp + (baseHeat * dt) - convection
      
      // Safety limits (Hardcoded for research POC, should come from spec)
      const critical = ThermalSystem.DEFAULT_CRITICAL
      const throttle = ThermalSystem.DEFAULT_THROTTLE

      if (nextTemp > critical) {
        thermal.isThrottled = true
        // Shutdown logic will be handled by a higher-level state system or via events
      } else if (nextTemp > throttle) {
        thermal.isThrottled = true
      } else if (thermal.isThrottled && nextTemp < throttle - 5) {
        thermal.isThrottled = false
      }

      thermal.temperature = Math.max(18.0, nextTemp)
      thermal.lastUpdate = Date.now()
    })

    // 3. Conduction between adjacent entities in the same rack (optimized O(N) single-pass grouping)
    const rackChildrenMap = new Map<string, string[]>()
    const racks: string[] = []

    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        racks.push(id)
      } else if (transform.parentRackId) {
        if (!rackChildrenMap.has(transform.parentRackId)) {
          rackChildrenMap.set(transform.parentRackId, [])
        }
        rackChildrenMap.get(transform.parentRackId)!.push(id)
      }
    })

    racks.forEach(rackId => {
      const rackNodes = rackChildrenMap.get(rackId)
      if (!rackNodes || rackNodes.length < 2) return

      // Sort only the local rack nodes
      rackNodes.sort((a, b) => (transformMap.get(a)?.slotIndex ?? 0) - (transformMap.get(b)?.slotIndex ?? 0))

      for (let i = 0; i < rackNodes.length - 1; i++) {
        const idA = rackNodes[i]
        const idB = rackNodes[i+1]
        if (!idA || !idB) continue
        
        const thermalA = thermalMap.get(idA)
        const thermalB = thermalMap.get(idB)
        if (!thermalA || !thermalB) continue
        
        const diff = (thermalA.temperature - thermalB.temperature) * ThermalSystem.CONDUCTION_COEFFICIENT * dt
        
        thermalA.temperature -= diff
        thermalB.temperature += diff
      }
    })
  }
}
