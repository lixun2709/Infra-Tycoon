import { System } from '../System'
import type { PowerComponent, TransformComponent, ThermalComponent, ApplicationComponent, RackComponent, ConnectionComponent } from '../types'
import { HARDWARE_CATALOG } from '../../../physics/hardwareLibrary'

/**
 * PowerSystem
 * ECS implementation of power distribution, load balancing, dual-feed redundancy, 
 * dynamic utilization scaling, 3-phase balancing, apparent power, UPS backup, 
 * and sustained circuit breaker tripping.
 */
export class PowerSystem extends System {
  // Global grid feed state (Phase A and Phase B power lines from utility transformer)
  public static facilityFeeds = {
    A: true,
    B: true
  }

  // Zero-Allocation Pools
  private racksPool: string[] = []
  private deviceNodesPool: string[] = []
  private rackChildrenMap = new Map<string, string[]>()
  private nodeAppCount = new Map<string, number>()
  private nodeThroughput = new Map<string, number>()

  public clear() {
    this.racksPool.length = 0
    this.deviceNodesPool.length = 0
    this.rackChildrenMap.clear()
    this.nodeAppCount.clear()
    this.nodeThroughput.clear()
    super.clear()
  }

  public update(dt: number) {
    const powerMap = this.world.getComponentMap<PowerComponent>('power')
    const transformMap = this.world.getComponentMap<TransformComponent>('transform')
    const thermalMap = this.world.getComponentMap<ThermalComponent>('thermal')
    const appMap = this.world.getComponentMap<ApplicationComponent>('application')
    const connMap = this.world.getComponentMap<ConnectionComponent>('connection')
    const entities = this.world.getEntitiesWith(['power', 'transform'])

    this.racksPool.length = 0
    this.deviceNodesPool.length = 0
    this.rackChildrenMap.clear()
    this.nodeAppCount.clear()
    this.nodeThroughput.clear()

    // 0. Pre-aggregation Passes O(N)
    entities.forEach(id => {
      const transform = transformMap.get(id)!
      if (transform.type === 'rack') {
        this.racksPool.push(id)
      } else {
        this.deviceNodesPool.push(id)
        if (transform.parentRackId) {
          let children = this.rackChildrenMap.get(transform.parentRackId)
          if (!children) {
            children = []
            this.rackChildrenMap.set(transform.parentRackId, children)
          }
          children.push(id)
        }
      }
    })

    appMap.forEach((app) => {
      if (app.status === 'running') {
        this.nodeAppCount.set(app.nodeId, (this.nodeAppCount.get(app.nodeId) || 0) + 1)
      }
    })

    connMap.forEach((conn) => {
      const tp = conn.throughputGbps ?? 0
      if (tp > 0) {
        if (conn.startNodeId) this.nodeThroughput.set(conn.startNodeId, (this.nodeThroughput.get(conn.startNodeId) || 0) + tp)
        if (conn.endNodeId) this.nodeThroughput.set(conn.endNodeId, (this.nodeThroughput.get(conn.endNodeId) || 0) + tp)
      }
    })

    // 1. Process UPS battery status and main power status for each Rack PDU
    this.racksPool.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)

      if (rackPower && rackComp) {
        if (rackPower.upsMaxBatterySeconds === undefined) rackPower.upsMaxBatterySeconds = 30.0
        if (rackPower.upsBatterySeconds === undefined) rackPower.upsBatterySeconds = rackPower.upsMaxBatterySeconds

        if (rackPower.breakerTripped) {
          rackPower.isPowered = false
          rackPower.load = 0
          rackPower.apparentPowerVA = 0
          rackPower.upsBatterySeconds = 0
          rackComp.status = 'power_overload'
          return
        }

        const rackFeed = rackPower.feedSource ?? 'both'
        let hasGridPower = true
        if (rackFeed === 'A' && !PowerSystem.facilityFeeds.A) hasGridPower = false
        else if (rackFeed === 'B' && !PowerSystem.facilityFeeds.B) hasGridPower = false
        else if (rackFeed === 'both' && !PowerSystem.facilityFeeds.A && !PowerSystem.facilityFeeds.B) hasGridPower = false

        if (hasGridPower) {
          rackPower.isPowered = true
          rackPower.upsBatterySeconds = Math.min(rackPower.upsMaxBatterySeconds, rackPower.upsBatterySeconds + dt * 2.0)
        } else {
          if (rackPower.upsBatterySeconds > 0) {
            rackPower.isPowered = true
            rackPower.upsBatterySeconds = Math.max(0, rackPower.upsBatterySeconds - dt)
            
            if (rackPower.upsBatterySeconds < rackPower.upsMaxBatterySeconds - dt && rackPower.upsBatterySeconds > 0) {
              const remaining = Math.round(rackPower.upsBatterySeconds)
              if (remaining % 10 === 0 || remaining <= 5) {
                this.world.eventBus.publish('system:alert', {
                  entityId: rackId,
                  message: `WARNING: Utility power loss! Rack PDU [${transformMap.get(rackId)?.name || rackId}] running on UPS backup battery (${remaining}s remaining).`,
                  severity: 'warning'
                })
              }
            }
          } else {
            rackPower.isPowered = false
            rackPower.load = 0
            rackPower.apparentPowerVA = 0
          }
        }
      }
    })

    // 2. Process Power Feed Losses and Dynamic Wattage Scaling for computing/device nodes
    this.deviceNodesPool.forEach(id => {
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)!
      const thermal = thermalMap.get(id)

      if (power.baseWattage === undefined || !Number.isFinite(power.baseWattage) || Number.isNaN(power.baseWattage) || power.baseWattage <= 0) {
        const catalogSpec = transform.catalogKey ? HARDWARE_CATALOG[transform.catalogKey as keyof typeof HARDWARE_CATALOG] : null
        power.baseWattage = catalogSpec ? catalogSpec.wattage : (power.wattage && Number.isFinite(power.wattage) && power.wattage > 0 ? power.wattage : 300)
      }
      power.baseWattage = Math.max(50, Math.min(15000, power.baseWattage))

      power.phase = transform.slotIndex !== undefined ? (['A', 'B', 'C'][transform.slotIndex % 3] as 'A' | 'B' | 'C') : 'A'

      if (!transform.parentRackId) {
        if (power.upsMaxBatterySeconds === undefined) power.upsMaxBatterySeconds = 10.0
        if (power.upsBatterySeconds === undefined) power.upsBatterySeconds = power.upsMaxBatterySeconds
      }

      const feed = power.feedSource ?? 'both'
      let hasGridPower = true
      if (feed === 'A' && !PowerSystem.facilityFeeds.A) hasGridPower = false
      else if (feed === 'B' && !PowerSystem.facilityFeeds.B) hasGridPower = false
      else if (feed === 'both' && !PowerSystem.facilityFeeds.A && !PowerSystem.facilityFeeds.B) hasGridPower = false

      let parentPowered = true
      let parentTripped = false
      if (transform.parentRackId) {
        const rackPower = powerMap.get(transform.parentRackId)
        if (rackPower) {
          parentPowered = rackPower.isPowered
          parentTripped = rackPower.breakerTripped ?? false
        }
      }

      const isBreakerCut = power.breakerTripped || parentTripped

      if (isBreakerCut) {
        power.isPowered = false
        power.wattage = 0
        power.load = 0
        power.apparentPowerVA = 0
        return
      }

      if (transform.parentRackId) {
        power.isPowered = parentPowered && power.systemState !== 'off'
      } else {
        if (hasGridPower) {
          power.isPowered = true
          power.upsBatterySeconds = Math.min(power.upsMaxBatterySeconds!, power.upsBatterySeconds! + dt * 2.0)
        } else {
          if (power.upsBatterySeconds! > 0) {
            power.isPowered = true
            power.upsBatterySeconds = Math.max(0, power.upsBatterySeconds! - dt)
          } else {
            power.isPowered = false
          }
        }
      }

      if (!power.isPowered) {
        power.wattage = 0
        power.load = 0
        power.apparentPowerVA = 0
        return
      }

      const appCount = this.nodeAppCount.get(id) || 0
      const tp = this.nodeThroughput.get(id) || 0
      const networkUtil = Math.min(100.0, tp * 10.0)

      const utilization = Math.min(100.0, appCount * 30.0 + networkUtil)
      const fanSpeed = thermal?.fanSpeedPercent ?? 0.0

      let baseScale = 1.0
      let util = utilization
      if (power.systemState === 'booting') {
        baseScale = 0.5
        util = 0.0
      }

      const internalDCWattage = power.baseWattage * baseScale * (1.0 + (util / 100.0) * 0.5) + (fanSpeed / 100.0) * 50.0
      const efficiency = power.efficiency && power.efficiency > 0.5 && power.efficiency <= 1.0 ? power.efficiency : 0.85
      let dynamicWattage = internalDCWattage / efficiency

      if (!Number.isFinite(dynamicWattage) || Number.isNaN(dynamicWattage) || dynamicWattage < 0) {
        dynamicWattage = power.baseWattage
      }
      
      dynamicWattage = Math.max(10, Math.min(15000, dynamicWattage))

      const powerFactor = Math.max(0.85, Math.min(0.99, 0.85 + 0.13 * (utilization / 100.0)))
      power.powerFactor = powerFactor

      let apparentPower = dynamicWattage / powerFactor
      if (!Number.isFinite(apparentPower) || Number.isNaN(apparentPower)) apparentPower = dynamicWattage
      power.apparentPowerVA = apparentPower

      power.wattage = dynamicWattage
      power.load = dynamicWattage / 1000.0
    })

    // 3. Sum child power draw to compile 3-Phase PDU rack loads
    this.racksPool.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      if (!rackPower.isPowered) {
        rackPower.load = 0
        rackPower.apparentPowerVA = 0
        rackPower.phaseLoadsWatts = [0, 0, 0]
        rackPower.phaseLoadsVA = [0, 0, 0]
        return
      }

      let pWatts0 = 0, pWatts1 = 0, pWatts2 = 0
      let pVA0 = 0, pVA1 = 0, pVA2 = 0

      const children = this.rackChildrenMap.get(rackId)
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const id = children[i]
          const transform = transformMap.get(id)!
          if (transform.type === 'cooling') continue

          const childPower = powerMap.get(id)
          if (childPower && childPower.isPowered) {
            const serverPhase = childPower.phase ?? 'A'
            const cWattage = Number.isFinite(childPower.wattage) && !Number.isNaN(childPower.wattage) ? childPower.wattage : 0
            const cVA = (childPower.apparentPowerVA !== undefined && Number.isFinite(childPower.apparentPowerVA) && !Number.isNaN(childPower.apparentPowerVA)) ? childPower.apparentPowerVA : cWattage
            
            if (serverPhase === 'A') {
              pWatts0 += cWattage; pVA0 += cVA
            } else if (serverPhase === 'B') {
              pWatts1 += cWattage; pVA1 += cVA
            } else {
              pWatts2 += cWattage; pVA2 += cVA
            }
          }
        }
      }

      let totalWatts = pWatts0 + pWatts1 + pWatts2
      let totalVA = pVA0 + pVA1 + pVA2

      totalWatts = Math.max(0, Math.min(150000, totalWatts))
      totalVA = Math.max(0, Math.min(150000, totalVA))

      if (!Number.isFinite(pWatts0) || Number.isNaN(pWatts0)) pWatts0 = 0
      if (!Number.isFinite(pWatts1) || Number.isNaN(pWatts1)) pWatts1 = 0
      if (!Number.isFinite(pWatts2) || Number.isNaN(pWatts2)) pWatts2 = 0
      if (!Number.isFinite(pVA0) || Number.isNaN(pVA0)) pVA0 = 0
      if (!Number.isFinite(pVA1) || Number.isNaN(pVA1)) pVA1 = 0
      if (!Number.isFinite(pVA2) || Number.isNaN(pVA2)) pVA2 = 0

      rackPower.phaseLoadsWatts = [pWatts0, pWatts1, pWatts2]
      rackPower.phaseLoadsVA = [pVA0, pVA1, pVA2]

      rackPower.wattage = totalWatts
      rackPower.apparentPowerVA = totalVA
      rackPower.load = totalWatts / 1000.0
    })

    // 4. Update Rack status, timers, and trigger phase or total overload breaker trips
    this.racksPool.forEach(rackId => {
      const rackPower = powerMap.get(rackId)!
      const transform = transformMap.get(rackId)
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)

      if (rackPower && rackComp) {
        if (rackComp.status === 'power_overload' && !rackPower.breakerTripped) {
          console.log(`[PowerSystem] Detected BREAKER RESET or recovery initiation on Rack: ${rackId}. Re-evaluating...`)
        }

        if (rackPower.breakerTripped) {
          rackPower.isPowered = false
          rackPower.load = 0
          rackPower.apparentPowerVA = 0
          rackComp.status = 'power_overload'
          return
        }

        const nominalLimit = Number.isFinite(rackComp.maxPowerKW) && rackComp.maxPowerKW > 0 ? rackComp.maxPowerKW : 5.0
        const maxLimit = (rackComp.deratedMaxPowerKW !== undefined && Number.isFinite(rackComp.deratedMaxPowerKW)) ? rackComp.deratedMaxPowerKW : nominalLimit
        const totalLoadKW = Number.isFinite(rackPower.load) && !Number.isNaN(rackPower.load) ? rackPower.load : 0.0

        const maxPhaseLimitKW = (maxLimit / 3.0) * 1.15

        const phaseA_KW = (rackPower.phaseLoadsWatts?.[0] ?? 0) / 1000.0
        const phaseB_KW = (rackPower.phaseLoadsWatts?.[1] ?? 0) / 1000.0
        const phaseC_KW = (rackPower.phaseLoadsWatts?.[2] ?? 0) / 1000.0
        const maxPhaseKW = Math.max(phaseA_KW, phaseB_KW, phaseC_KW)

        const isTotalOverloaded = totalLoadKW > maxLimit
        const isPhaseOverloaded = maxPhaseKW > maxPhaseLimitKW
        const isOverloaded = isTotalOverloaded || isPhaseOverloaded

        if (isOverloaded) {
          const nextOverloadTime = (rackPower.overloadSeconds ?? 0) + dt
          rackPower.overloadSeconds = nextOverloadTime

          if (nextOverloadTime >= 10.0) {
            rackPower.breakerTripped = true
            rackPower.isPowered = false
            rackPower.load = 0
            rackPower.apparentPowerVA = 0
            rackPower.overloadSeconds = 0
            rackComp.status = 'power_overload'

            const children = this.rackChildrenMap.get(rackId)
            if (children) {
              for (let i = 0; i < children.length; i++) {
                const childId = children[i]
                const childPower = powerMap.get(childId)
                if (childPower) {
                  childPower.isPowered = false
                  childPower.wattage = 0
                  childPower.load = 0
                  childPower.apparentPowerVA = 0
                  childPower.systemState = 'off'
                }
              }
            }

            let tripMessage = `CRITICAL: Rack PDU Breaker TRIPPED on [${transform?.name || rackId}] due to prolonged `
            if (isPhaseOverloaded && !isTotalOverloaded) {
              tripMessage += `Phase Imbalance! Max phase load exceeded safety limit (${maxPhaseKW.toFixed(2)} kW > ${maxPhaseLimitKW.toFixed(2)} kW).`
            } else {
              tripMessage += `total power overload (${totalLoadKW.toFixed(2)} kW > ${maxLimit.toFixed(2)} kW)!`
            }

            console.log(
              `[PowerSystem] BREAKER TRIP TRIGGERED on Rack Entity: ${rackId}. Total Load: ${totalLoadKW.toFixed(2)} kW / Max Limit: ${maxLimit.toFixed(2)} kW.`
            )

            this.world.eventBus.publish('system:alert', {
              entityId: rackId,
              message: tripMessage,
              severity: 'critical'
            })
          }
        } else {
          rackPower.overloadSeconds = 0
        }
      }
    })
  }
}
