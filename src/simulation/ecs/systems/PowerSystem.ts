import { System } from '../System'
import type { PowerComponent, TransformComponent, ThermalComponent, ApplicationComponent, RackComponent, ConnectionComponent } from '../types'
import { UPSManager } from './power/UPSManager'
import { DevicePowerCalculator } from './power/DevicePowerCalculator'
import { PhaseBalancer } from './power/PhaseBalancer'
import { BreakerManager } from './power/BreakerManager'

/**
 * PowerSystem
 * Orchestrates power distribution, load balancing, dual-feed redundancy, 
 * dynamic utilization scaling, 3-phase balancing, apparent power, UPS backup, 
 * and sustained circuit breaker tripping using specialized sub-modules.
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
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i]!
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
    }

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
    for (let i = 0; i < this.racksPool.length; i++) {
      const rackId = this.racksPool[i]!
      const rackPower = powerMap.get(rackId)!
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)

      if (rackPower && rackComp) {
        UPSManager.processRackUPS(
          dt, 
          rackId, 
          rackPower, 
          rackComp, 
          transformMap.get(rackId), 
          PowerSystem.facilityFeeds, 
          this.world.eventBus
        )
      }
    }

    // 2. Process Power Feed Losses and Dynamic Wattage Scaling for computing/device nodes
    for (let i = 0; i < this.deviceNodesPool.length; i++) {
      const id = this.deviceNodesPool[i]!
      const transform = transformMap.get(id)!
      const power = powerMap.get(id)!
      const thermal = thermalMap.get(id)

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
        continue
      }

      if (transform.parentRackId) {
        power.isPowered = parentPowered && power.systemState !== 'off'
      } else {
        UPSManager.processStandaloneUPS(dt, power, PowerSystem.facilityFeeds)
      }

      const appCount = this.nodeAppCount.get(id) || 0
      const tp = this.nodeThroughput.get(id) || 0

      DevicePowerCalculator.calculate(power, transform, thermal, appCount, tp)
    }

    // 3. Sum child power draw to compile 3-Phase PDU rack loads
    for (let i = 0; i < this.racksPool.length; i++) {
      const rackId = this.racksPool[i]!
      const rackPower = powerMap.get(rackId)!
      const children = this.rackChildrenMap.get(rackId)

      PhaseBalancer.calculateRackPhases(rackPower, children, powerMap, transformMap)
    }

    // 4. Update Rack status, timers, and trigger phase or total overload breaker trips
    for (let i = 0; i < this.racksPool.length; i++) {
      const rackId = this.racksPool[i]!
      const rackPower = powerMap.get(rackId)!
      const transform = transformMap.get(rackId)
      const rackComp = this.world.getComponent<RackComponent>('rack', rackId)
      const children = this.rackChildrenMap.get(rackId)

      if (rackPower && rackComp) {
        BreakerManager.evaluateRackBreaker(
          dt,
          rackId,
          rackPower,
          rackComp,
          transform,
          children,
          powerMap,
          this.world.eventBus
        )
      }
    }
  }
}
