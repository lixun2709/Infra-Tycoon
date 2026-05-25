import { System } from '../System'
import type { RackComponent, PowerComponent, TransformComponent, ThermalComponent } from '../types'

/**
 * Returns physical equipment weight in KG based on catalogKey and uHeight.
 */
function getDeviceWeightKG(catalogKey?: string, uHeight?: number): number {
  if (!catalogKey) {
    return 12 * (uHeight ?? 1)
  }
  switch (catalogKey) {
    case 'BLADE_CHASSIS_4U': return 65
    case 'BLADE_SERVER': return 4
    case 'GPU_NODE_2U': return 30
    case 'COMPUTE_1U': return 15
    case 'SAN_CONTROLLER_2U': return 35
    case 'DISK_SHELF_2U': return 40
    case 'NVME_ARRAY_1U': return 18
    case 'LEAF_SWITCH_1U': return 10
    case 'SPINE_SWITCH_2U': return 25
    case 'VPN_GATEWAY_1U': return 8
    case 'NG_FIREWALL_1U': return 12
    case 'SIEM_COLLECTOR_1U': return 15
    case 'IDS_IPS_NODE_2U': return 20
    case 'DIRECTORY_SERVER_1U': return 14
    case 'HSM_MODULE_1U': return 11
    case 'HIGH_DENSITY_PDU_1U': return 12
    case 'IN_ROW_CRAC_4U': return 120
    case 'ENV_SENSOR': return 0.5
    default:
      return 12 * (uHeight ?? 1)
  }
}

/**
 * RackSystem
 * ECS System governing physical rack configurations, slot occupancy maps, 
 * dynamic PDU capacity upgrades, and deterministic power overload state evaluations.
 */
export class RackSystem extends System {
  // O(1) persistent memory pool for mapping parent -> child transforms.
  // Avoids catastrophic garbage collection overhead from recreating Maps and Arrays every 16ms.
  private childrenByRackPool = new Map<string, string[]>()

  public update(_dt: number): void {
    const startTime = performance.now()

    const rackMap = this.world.getComponentMap<RackComponent>('rack')
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')

    // 1. High-Performance Pre-indexing: Map parentRackId to child entity IDs
    // Instead of `new Map()`, we dynamically clear existing arrays to keep memory contiguous.
    for (const arr of this.childrenByRackPool.values()) {
      arr.length = 0
    }

    transformMap.forEach((transform, entityId) => {
      if (transform.parentRackId) {
        let list = this.childrenByRackPool.get(transform.parentRackId)
        if (!list) {
          list = []
          this.childrenByRackPool.set(transform.parentRackId, list)
        }
        list.push(entityId)
      }
    })

    // 2. Perform validation, structural limits, and breaker checks in a SINGLE unified O(N) sweep
    rackMap.forEach((rack, rackId) => {
      const rackTransform = transformMap.get(rackId)
      const rackThermal = thermalMap.get(rackId)
      const rackPower = powerMap.get(rackId)

      // Initialize weight stats (Max 1000 kg capacity limit)
      rack.maxWeightKG = rack.maxWeightKG ?? 1000.0
      let totalWeight = 0.0

      // Automatically scale power limit if rack has high density PDU upgrade
      if (rack.hasHighDensityPDU) {
        rack.maxPowerKW = 15.0
      } else if (rack.maxPowerKW === undefined || rack.maxPowerKW === 5.0) {
        rack.maxPowerKW = 5.0
      }

      // Read ambient temperature & humidity from ThermalComponent
      const temperature = rackThermal?.temperature ?? 25.0
      rack.pduTemperature = temperature
      rack.humidity = rackThermal?.humidity ?? 45.0

      // PDU Thermal De-rating Curve: Above 35°C, de-rate limit by 2% per °C (max de-rating of 50%)
      let deRatingFactor = 1.0
      if (temperature > 35.0) {
        deRatingFactor = Math.max(0.5, 1.0 - (temperature - 35.0) * 0.02)
      }
      rack.deratedMaxPowerKW = rack.maxPowerKW * deRatingFactor

      // Persistent Array reuse: Prevent `new Array()` GC spikes
      if (!rack.slotOccupancy || rack.slotOccupancy.length !== 43) {
        rack.slotOccupancy = new Array(43).fill(false)
      } else {
        rack.slotOccupancy.fill(false)
      }

      if (!rack.collisionOccupancy || rack.collisionOccupancy.length !== 43) {
        rack.collisionOccupancy = new Array(43).fill(false)
      } else {
        rack.collisionOccupancy.fill(false)
      }

      const occupancy = rack.slotOccupancy
      const collisions = rack.collisionOccupancy
      const childrenIds = this.childrenByRackPool.get(rackId) ?? []

      // Iterate only through this rack's specific children
      childrenIds.forEach((childId) => {
        const childTransform = transformMap.get(childId)
        if (!childTransform || childTransform.type === 'rack' || childTransform.type === 'cooling') {
          return
        }

        const slot = childTransform.slotIndex
        const height = childTransform.uHeight || 1

        // Sum equipment weight
        totalWeight += getDeviceWeightKG(childTransform.catalogKey, height)

        if (slot != null) {
          // U-Height boundary validation (e.g. slots 1-42)
          if (slot < 1 || slot + height - 1 > 42) {
            this.world.eventBus.publish('system:alert', {
              severity: 'warning',
              message: `[RACK BOUNDARY VIOLATION] Hardware Unit [${childTransform.name || childId}] exceeds physical 42U rack bounds on [${rackTransform?.name || rackId}] (Slot U${slot}, Height ${height}U)!`,
              nodeId: rackId
            })
          }

          // Slot collision check
          for (let u = slot; u < slot + height; u++) {
            if (u >= 1 && u <= 42) {
              if (occupancy[u]) {
                if (!collisions[u]) {
                  collisions[u] = true
                  this.world.eventBus.publish('system:alert', {
                    severity: 'warning',
                    message: `[RACK SLOT COLLISION] Server Rack [${rackTransform?.name || rackId}] has slot booking conflict at Slot U${u}!`,
                    nodeId: rackId
                  })
                }
              }
              occupancy[u] = true
            }
          }
        }
      })

      // Structural weight limit check
      rack.totalWeightKG = parseFloat(totalWeight.toFixed(2))
      if (totalWeight > rack.maxWeightKG) {
        if (rack.weightStatus !== 'structural_warning') {
          rack.weightStatus = 'structural_warning'
          this.world.eventBus.publish('system:alert', {
            severity: 'warning',
            message: `[RACK WEIGHT EXCEEDED] Server Rack [${rackTransform?.name || rackId}] has exceeded its structural weight limit! (Weight: ${totalWeight.toFixed(2)} kg / Max: ${rack.maxWeightKG.toFixed(2)} kg)`,
            nodeId: rackId
          })
        }
      } else {
        rack.weightStatus = 'nominal'
      }

      // 3. Phase Imbalance Monitoring
      if (rackPower && rackPower.isPowered) {
        const pWatts = rackPower.phaseLoadsWatts ?? [0, 0, 0]
        const totalWatts = pWatts[0] + pWatts[1] + pWatts[2]
        
        if (totalWatts > 1000.0) { // Monitor imbalance only under significant load (> 1 kW)
          const avgPhaseWatts = totalWatts / 3.0
          let hasImbalance = false
          for (let i = 0; i < 3; i++) {
            const dev = Math.abs((pWatts[i] ?? 0) - avgPhaseWatts) / avgPhaseWatts
            if (dev > 0.35) {
              hasImbalance = true
              break
            }
          }

          if (hasImbalance) {
            if (!rack.hasPhaseImbalance) {
              rack.hasPhaseImbalance = true
              this.world.eventBus.publish('system:alert', {
                severity: 'warning',
                message: `[PHASE IMBALANCE ALERT] Server Rack [${rackTransform?.name || rackId}] has severe load imbalance between Phase feeds! (P_A: ${(pWatts[0]/1000).toFixed(2)} kW, P_B: ${(pWatts[1]/1000).toFixed(2)} kW, P_C: ${(pWatts[2]/1000).toFixed(2)} kW)`,
                nodeId: rackId
              })
            }
          } else {
            rack.hasPhaseImbalance = false
          }
        } else {
          rack.hasPhaseImbalance = false
        }

        // 4. Perform breaker overload checks and dynamic load updates
        const load = rackPower.load || 0.0 // computed in kW by PowerSystem
        const maxLimit = rack.deratedMaxPowerKW ?? rack.maxPowerKW

        if (load > maxLimit) {
          if (rack.status === 'online') {
            rack.status = 'power_overload'
            this.world.eventBus.publish('system:alert', {
              severity: 'critical',
              message: `[RACK OVERLOAD] Server Rack [${rackTransform?.name || rackId}] has exceeded its power limit! (Load: ${load.toFixed(2)} kW / Max: ${maxLimit.toFixed(2)} kW)`,
              nodeId: rackId
            })
          }
        } else {
          // Recovery alert only if load returns to normal AND breaker is not tripped
          if (rack.status === 'power_overload' && !rackPower.breakerTripped) {
            rack.status = 'online'
            console.log(
              `[RackSystem] NOMINAL RECOVERY on Rack Entity: ${rackId} (${rackTransform?.name || 'Unnamed'}). ` +
              `Status transitioned from power_overload to online. Current Load: ${load.toFixed(2)} kW / Max Limit: ${maxLimit.toFixed(2)} kW.`
            )
            this.world.eventBus.publish('system:alert', {
              severity: 'info',
              message: `[RACK RECOVERY] Server Rack [${rackTransform?.name || rackId}] power load recovered to normal levels. (Load: ${load.toFixed(2)} kW / Max: ${maxLimit.toFixed(2)} kW)`,
              nodeId: rackId
            })
          }
        }
        
        rack.currentPowerKW = load
      } else {
        rack.hasPhaseImbalance = false
      }
    })

    const tEnd = performance.now()
    if (Math.random() < 0.1) {
      this.world.eventBus.publish('telemetry:system', {
        subsystem: 'rack',
        executionTimeMs: Number((tEnd - startTime).toFixed(2))
      })
    }
  }
}
