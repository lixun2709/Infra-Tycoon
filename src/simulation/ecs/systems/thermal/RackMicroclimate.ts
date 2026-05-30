import type { ThermalComponent, TransformComponent, RackComponent } from '../../types'
import type { ComponentMap } from '../../types'
import { World } from '../../World'
import { LoadStats, ThermalGlobals } from './ThermalGlobals'

function fastStringHash(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hashInt(val: number, hash: number): number {
  hash ^= (val & 0xFF)
  hash = Math.imul(hash, 16777619)
  hash ^= ((val >> 8) & 0xFF)
  hash = Math.imul(hash, 16777619)
  hash ^= ((val >> 16) & 0xFF)
  hash = Math.imul(hash, 16777619)
  hash ^= ((val >> 24) & 0xFF)
  hash = Math.imul(hash, 16777619)
  return hash >>> 0
}

export class RackMicroclimate {
  /**
   * Calculates rack localized hot/cold aisle recirculation, convection, and conduction.
   */
  public static processRackMicroclimates(
    racksPool: readonly string[],
    racksBySitePool: Map<string, string[]>,
    adjacentRackPairsBySite: Map<string, [string, string][]>,
    lastRackEntitiesHashBySite: Map<string, number>,
    deltaTempPool: Map<string, number>,
    rackLoadsPool: Map<string, LoadStats>,
    thermalMap: ComponentMap<ThermalComponent>,
    transformMap: ComponentMap<TransformComponent>,
    world: World,
    dt: number,
    accumulatedTime: number
  ) {
    racksPool.forEach(rackId => {
      const rackThermal = thermalMap.get(rackId)!
      const rackTransform = transformMap.get(rackId)!
      const siteId = rackTransform.siteId || 'default-site'
      const roomAmbientTemp = ThermalGlobals.siteAmbientTemps.get(siteId) ?? ThermalGlobals.BASE_AMBIENT_TEMP

      const containment = rackThermal.containmentType ?? 'none'
      let recircFraction = ThermalGlobals.RECIRCULATION_NONE
      if (containment === 'cold_aisle') {
        recircFraction = ThermalGlobals.RECIRCULATION_COLD_AISLE
      } else if (containment === 'hot_aisle') {
        recircFraction = ThermalGlobals.RECIRCULATION_HOT_AISLE
      }

      const load = rackLoadsPool.get(rackId) ?? { serverHeatBTU: 0, coolingBTU: 0 }

      // Containment Airflow Impedance: Bypass leaks through empty slots without blanking panels
      let emptySlotsWithoutPanels = 0
      const rackComp = world.getComponent<RackComponent>('rack', rackId)
      if (rackComp) {
        if (!rackComp.blankingPanels) {
          rackComp.blankingPanels = []
        }
        for (let u = 1; u <= 42; u++) {
          const isOccupied = rackComp.slotOccupancy[u] ?? false
          const hasPanel = rackComp.blankingPanels[u] ?? true
          if (!isOccupied && !hasPanel) {
            emptySlotsWithoutPanels++
          }
        }
      }
      const bypassAirflowFactor = Math.max(0.1, 1.0 - 0.05 * emptySlotsWithoutPanels)
      const adjustedCoolingBTU = load.coolingBTU * bypassAirflowFactor
      const netRackHeat = recircFraction * load.serverHeatBTU - adjustedCoolingBTU

      const currentRackTemp = rackThermal.temperature ?? roomAmbientTemp
      const rackTargetTemp = roomAmbientTemp + (netRackHeat / ThermalGlobals.RACK_CONV_COEFF)
      const rackTargetClamped = Math.max(16.0, Math.min(65.0, rackTargetTemp))

      const rackAlpha = 1.0 - Math.exp(-dt / ThermalGlobals.RACK_TIME_CONSTANT)
      const nextRackTemp = currentRackTemp + (rackTargetClamped - currentRackTemp) * rackAlpha

      rackThermal.temperature = nextRackTemp

      // Relative Humidity Calculations for Rack containment
      const roomHumidity = ThermalGlobals.siteAmbientHumidity.get(siteId) ?? 45.0
      // Localized heating drops relative humidity within the rack containment
      const tempDiff = Math.max(0.0, nextRackTemp - roomAmbientTemp)
      const rackHumidity = Math.max(10.0, roomHumidity - tempDiff * 0.8)
      rackThermal.humidity = rackHumidity

      rackThermal.accumulatedSimTime = accumulatedTime
      rackThermal.lastUpdate = Math.floor(accumulatedTime * 1000)
    })

    // Localized Hot Aisle lateral convection between adjacent racks
    racksPool.forEach(id => {
      const transform = transformMap.get(id)
      if (transform) {
        const sId = transform.siteId || 'default-site'
        let list = racksBySitePool.get(sId)
        if (!list) {
          list = []
          racksBySitePool.set(sId, list)
        }
        list.push(id)
      }
    })

    racksBySitePool.forEach((rackIds, siteId) => {
      rackIds.forEach(id => deltaTempPool.set(id, 0))

      const kConvection = 0.05 // lateral convection multiplier

      // Cache adjacent neighbors to avoid O(N^2) math operations and square roots every frame
      let siteHash = 0
      for (let i = 0; i < rackIds.length; i++) {
        const rId = rackIds[i]!
        const pos = transformMap.get(rId)?.position
        if (pos) {
          const h1 = fastStringHash(rId)
          const h2 = hashInt(Math.round(pos.x * 10), h1)
          const h3 = hashInt(Math.round(pos.z * 10), h2)
          siteHash = (siteHash + h3) >>> 0
        }
      }
      
      const cachedHash = lastRackEntitiesHashBySite.get(siteId)

      if (siteHash !== cachedHash) {
        const pairs: [string, string][] = []
        for (let i = 0; i < rackIds.length; i++) {
          const rA = rackIds[i]!
          const transA = transformMap.get(rA)
          const posA = transA?.position
          if (!posA) continue

          for (let j = i + 1; j < rackIds.length; j++) {
            const rB = rackIds[j]!
            const transB = transformMap.get(rB)
            const posB = transB?.position
            if (!posB) continue

            const dx = posA.x - posB.x
            const dz = posA.z - posB.z
            const distSq = dx * dx + dz * dz

            // Racks are adjacent if distance <= 1.8 units in the horizontal plane (1.8^2 = 3.24)
            if (distSq > 0 && distSq <= 3.24) {
              pairs.push([rA, rB])
            }
          }
        }
        adjacentRackPairsBySite.set(siteId, pairs)
        lastRackEntitiesHashBySite.set(siteId, siteHash)
      }

      const pairs = adjacentRackPairsBySite.get(siteId) || []
      pairs.forEach(([rA, rB]) => {
        const tA = thermalMap.get(rA)
        const tB = thermalMap.get(rB)
        if (tA && tB) {
          const flow = kConvection * (tB.temperature - tA.temperature) * dt
          deltaTempPool.set(rA, deltaTempPool.get(rA)! + flow)
          deltaTempPool.set(rB, deltaTempPool.get(rB)! - flow)
        }
      })

      rackIds.forEach(id => {
        const thermal = thermalMap.get(id)
        if (thermal) {
          const dT = deltaTempPool.get(id) ?? 0
          thermal.temperature = Math.max(16.0, Math.min(65.0, thermal.temperature + dT))
        }
      })
    })
  }
}
