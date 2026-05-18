import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import type { InfraNode, Connection } from '../../../store/infraTypes'
import { calculateNodeDemand } from '../demand'
import { buildAdjacencyMap } from '../topology'
import { resolveCongestion } from '../congestion'
import { simulateNetwork } from '../simulation'

describe('Day 31 Deterministic Network Simulation Engine', () => {
  const mockComputeNode: InfraNode = {
    id: 'node-compute',
    name: 'Compute Server 1',
    type: 'compute',
    siteId: 'site-1',
    position: new Vector3(0, 0, 0),
    provisioningState: 'bootstrapped',
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 500,
    uHeight: 2,
    btuOutput: 0,
    bootProgress: 100,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected'
  }

  const mockSwitchNode: InfraNode = {
    id: 'node-switch',
    name: 'Rack Switch 1',
    type: 'network',
    siteId: 'site-1',
    position: new Vector3(0, 0, 0),
    provisioningState: 'bootstrapped',
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 150,
    uHeight: 1,
    btuOutput: 0,
    bootProgress: 100,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected'
  }

  describe('Phase 1: Demand & IncidentProfile Evaluation', () => {
    it('should compute base traffic demands depending on node type', () => {
      const computeDemand = calculateNodeDemand(mockComputeNode, 0.5)
      expect(computeDemand.demandGbps).toBeCloseTo(0.8 * 1.5, 2)
      
      const switchDemand = calculateNodeDemand(mockSwitchNode, 0.5)
      expect(switchDemand.demandGbps).toBe(0.1) // management control plane baseline
    })

    it('should apply ransomware multipliers during security incidents', () => {
      const infectedNode = { ...mockComputeNode, isInfected: true }
      const demand = calculateNodeDemand(infectedNode, 0)
      // 0.8 base * 2.5 ransomware multiplier = 2.0 Gbps
      expect(demand.demandGbps).toBeCloseTo(2.0, 2)
      expect(demand.activeIncident).toBe('ransomware')
    })

    it('should drop traffic during severe hardware degradation', () => {
      const degradedNode = { ...mockComputeNode, healthStatus: 'critical' as const }
      const demand = calculateNodeDemand(degradedNode, 0)
      // 0.8 base * 0.1 degraded multiplier = 0.08 Gbps
      expect(demand.demandGbps).toBeCloseTo(0.08, 2)
      expect(demand.activeIncident).toBe('degraded')
    })
  })

  describe('Phase 2: High-Performance Topology Mapping', () => {
    it('should map nodes to connected connections', () => {
      const conn: Connection = {
        id: 'conn-1',
        startNodeId: 'node-compute',
        startPortId: 'p1',
        endNodeId: 'node-switch',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 1
      }

      const map = buildAdjacencyMap([conn])
      expect(map.connectionMap.get('conn-1')).toBe(conn)
      expect(map.nodeToConnections.get('node-compute')).toContain('conn-1')
      expect(map.nodeToConnections.get('node-switch')).toContain('conn-1')
    })
  })

  describe('Phase 3: Trunk Aggregation, Queue Penalties & Degradation', () => {
    it('should estimate throughput on server links', () => {
      const conn: Connection = {
        id: 'conn-1',
        startNodeId: 'node-compute',
        startPortId: 'p1',
        endNodeId: 'node-switch',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 1
      }

      const nodes = [mockComputeNode, mockSwitchNode]
      const demands = nodes.map(n => calculateNodeDemand(n, 0))
      const map = buildAdjacencyMap([conn])

      const { updatedConnections } = resolveCongestion(nodes, [conn], demands, map)
      expect(updatedConnections[0]?.throughputGbps).toBe(0.8) // matches compute server demand
    })

    it('should scale queuing delay latencies and degrade saturated links', () => {
      const conn: Connection = {
        id: 'conn-1',
        startNodeId: 'node-compute',
        startPortId: 'p1',
        endNodeId: 'node-switch',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 1, // very low bandwidth to force saturation
        throughputGbps: 0,
        latencyMs: 1
      }

      // Infected node generating 2.0 Gbps (exceeds 1 Gbps bandwidth)
      const infectedNode = { ...mockComputeNode, isInfected: true }
      const nodes = [infectedNode, mockSwitchNode]
      const demands = nodes.map(n => calculateNodeDemand(n, 0))
      const map = buildAdjacencyMap([conn])

      const { updatedConnections } = resolveCongestion(nodes, [conn], demands, map)
      const resolved = updatedConnections[0]!
      
      expect(resolved.status).toBe('degraded')
      expect(resolved.throughputGbps).toBe(1.0) // capped at bandwidth
      expect(resolved.latencyMs).toBeGreaterThan(1.0) // queuing latency applied!
    })
  })

  describe('Phase 4: Integrated Pipeline Simulation Orchestration', () => {
    it('should process tick pipeline deterministically', () => {
      const conn: Connection = {
        id: 'conn-1',
        startNodeId: 'node-compute',
        startPortId: 'p1',
        endNodeId: 'node-switch',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 1
      }

      const result = simulateNetwork([mockComputeNode, mockSwitchNode], [conn], 0)
      expect(result.connections.length).toBe(1)
      expect(result.connections[0]?.throughputGbps).toBe(0.8)
    })
  })
})
