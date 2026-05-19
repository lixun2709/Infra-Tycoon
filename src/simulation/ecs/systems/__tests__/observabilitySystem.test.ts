import { describe, it, expect, beforeEach } from 'vitest'
import { World } from '../../World'
import { ObservabilitySystem } from '../ObservabilitySystem'
import type { 
  ThermalComponent, 
  PowerComponent, 
  StorageComponent,
  ConnectionComponent,
  TransformComponent
} from '../../types'

describe('Observability ECS System Core Tests', () => {
  let world: World
  let system: ObservabilitySystem

  beforeEach(() => {
    world = new World()
    system = new ObservabilitySystem(world)
    ObservabilitySystem.clear()
  })

  describe('Thermal Threshold Alerting', () => {
    it('should fire critical thermal overheat warning after 3 consecutive hot ticks', () => {
      const nodeId = 'node-compute-1'
      world.registerEntity(nodeId)

      world.addComponent('transform', {
        entityId: nodeId,
        type: 'compute',
        name: 'compute-server-1',
        siteId: 'site-1'
      } as TransformComponent)

      world.addComponent('thermal', {
        entityId: nodeId,
        temperature: 75.0, // > 70 threshold
        isThrottled: false,
        fanSpeedPercent: 40.0,
        btuOutput: 1000
      } as ThermalComponent)

      // First tick
      system.update(1.0)
      let alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(0) // Needs 3 ticks

      // Second tick
      system.update(1.0)
      alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(0)

      // Third tick
      system.update(1.0)
      alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(1)
      expect(alerts[0]!.severity).toBe('critical')
      expect(alerts[0]!.nodeId).toBe(nodeId)
      expect(alerts[0]!.message).toContain('[OBSERVABILITY]')
      expect(alerts[0]!.message).toContain('Critical Node Overheat Warning')
      expect(alerts[0]!.message).toContain('compute-server-1')

      // Fourth tick (alert is already active, so should prevent spamming)
      system.update(1.0)
      alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(0)
    })

    it('should reset trigger counts if temperature falls below threshold before required ticks', () => {
      const nodeId = 'node-compute-2'
      world.registerEntity(nodeId)

      world.addComponent('transform', {
        entityId: nodeId,
        type: 'compute',
        name: 'compute-server-2',
        siteId: 'site-1'
      } as TransformComponent)

      const thermal = {
        entityId: nodeId,
        temperature: 75.0, // hot
        isThrottled: false,
        fanSpeedPercent: 40.0,
        btuOutput: 1000
      } as ThermalComponent
      world.addComponent('thermal', thermal)

      // Tick 1 (Hot)
      system.update(1.0)
      
      // Tick 2 (Cooled down)
      thermal.temperature = 65.0
      world.addComponent('thermal', thermal)
      system.update(1.0)

      // Tick 3 (Hot again)
      thermal.temperature = 75.0
      world.addComponent('thermal', thermal)
      system.update(1.0)

      // Tick 4 (Hot)
      system.update(1.0)

      let alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(0) // Trigger reset on Tick 2, so Tick 3-4 only counted as 2 ticks

      // Tick 5 (Hot) -> Now should fire (3 ticks: Tick 3, 4, 5)
      system.update(1.0)
      alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(1)
    })
  })

  describe('Power Demand Alerting', () => {
    it('should fire power grid demand warning after 2 ticks of high load', () => {
      const nodeId = 'node-power-1'
      world.registerEntity(nodeId)

      world.addComponent('transform', {
        entityId: nodeId,
        type: 'compute',
        siteId: 'site-1'
      } as TransformComponent)

      // High load (85kW, which is > 80kW threshold)
      world.addComponent('power', {
        entityId: nodeId,
        wattage: 100,
        load: 85.0,
        isPowered: true,
        efficiency: 0.95
      } as PowerComponent)

      system.update(1.0)
      expect(ObservabilitySystem.flushAlerts().length).toBe(0) // Needs 2 ticks

      system.update(1.0)
      const alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(1)
      expect(alerts[0]!.severity).toBe('warning')
      expect(alerts[0]!.nodeId).toBeUndefined() // Global alert
      expect(alerts[0]!.message).toContain('High Power Grid Demand')
    })
  })

  describe('Storage Volume Exhaustion Alerting', () => {
    it('should fire storage warning after 4 ticks above 90% capacity', () => {
      const nodeId = 'node-storage-1'
      world.registerEntity(nodeId)

      world.addComponent('transform', {
        entityId: nodeId,
        type: 'storage',
        siteId: 'site-1'
      } as TransformComponent)

      // 95% full (95TB used of 100TB capacity)
      world.addComponent('storage', {
        entityId: nodeId,
        totalStorageTB: 100.0,
        usedStorageTB: 95.0,
        ioPSLimit: 1000,
        ioPSUsed: 0,
        raidLevel: 'RAID5',
        storageStatus: 'healthy',
        rebuildProgress: 0,
        driveDegradation: 0
      } as StorageComponent)

      for (let i = 0; i < 3; i++) {
        system.update(1.0)
        expect(ObservabilitySystem.flushAlerts().length).toBe(0) // Needs 4 ticks
      }

      system.update(1.0)
      const alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(1)
      expect(alerts[0]!.severity).toBe('warning')
      expect(alerts[0]!.message).toContain('Storage Volume Exhaustion')
      expect(alerts[0]!.message).toContain('volume is 95.0% full')
    })
  })

  describe('Interface Link Congestion Alerting', () => {
    it('should fire link congestion alert after 2 ticks of degraded connections', () => {
      const connId = 'conn-1'
      world.registerEntity(connId)

      world.addComponent('connection', {
        entityId: connId,
        startNodeId: 'node-1',
        startPortId: 'port-1',
        endNodeId: 'node-2',
        endPortId: 'port-2',
        bandwidthGbps: 10,
        throughputGbps: 9.5,
        latencyMs: 10.0,
        status: 'degraded' // > 0 degraded triggers
      } as ConnectionComponent)

      system.update(1.0)
      expect(ObservabilitySystem.flushAlerts().length).toBe(0) // Needs 2 ticks

      system.update(1.0)
      const alerts = ObservabilitySystem.flushAlerts()
      expect(alerts.length).toBe(1)
      expect(alerts[0]!.severity).toBe('warning')
      expect(alerts[0]!.message).toContain('Interface Link Congestion Warning')
    })
  })
})
