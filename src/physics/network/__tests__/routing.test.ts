import { describe, it, expect, beforeEach } from 'vitest'
import { resolveCongestion } from '../congestion'
import { calculateNodeDemand } from '../demand'
import { buildAdjacencyMap } from '../topology'
import { useInfraStore } from '../../../store/useInfraStore'
import type { InfraNode, Connection } from '../../../store/infraTypes'
import * as THREE from 'three'

describe('Day 40 Weighted Dijkstra Routing & Packet Loss Tests', () => {
  const nodeA: InfraNode = {
    id: 'node-a',
    name: 'Server A',
    type: 'compute',
    siteId: 'site-1',
    position: new THREE.Vector3(0, 0, 0),
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 500,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected',
    uHeight: 1,
    btuOutput: 0,
    bootProgress: 100,
    provisioningState: 'bootstrapped'
  }

  const nodeB: InfraNode = {
    id: 'node-b',
    name: 'Switch B',
    type: 'network',
    siteId: 'site-1',
    position: new THREE.Vector3(1, 0, 0),
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 150,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected',
    uHeight: 1,
    btuOutput: 0,
    bootProgress: 100,
    provisioningState: 'bootstrapped'
  }

  const nodeC: InfraNode = {
    id: 'node-c',
    name: 'Server C',
    type: 'compute',
    siteId: 'site-1',
    position: new THREE.Vector3(2, 0, 0),
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 500,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected',
    uHeight: 1,
    btuOutput: 0,
    bootProgress: 100,
    provisioningState: 'bootstrapped'
  }

  const nodeD: InfraNode = {
    id: 'node-d',
    name: 'Router D',
    type: 'network',
    siteId: 'site-1',
    position: new THREE.Vector3(1, 1, 0),
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 300,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected',
    uHeight: 1,
    btuOutput: 0,
    bootProgress: 100,
    provisioningState: 'bootstrapped'
  }

  describe('Connection Congestion & Packet Loss', () => {
    it('should compute zero packet loss for uncongested links', () => {
      const conn: Connection = {
        id: 'conn-1',
        startNodeId: 'node-a',
        startPortId: 'p1',
        endNodeId: 'node-b',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 1
      }

      const nodes = [nodeA, nodeB]
      const demands = nodes.map(n => calculateNodeDemand(n, 0))
      const map = buildAdjacencyMap([conn])

      const { updatedConnections } = resolveCongestion(nodes, [conn], demands, map)
      expect(updatedConnections[0]?.packetLoss).toBe(0.0)
    })

    it('should compute exponential packet loss when link capacity is saturated', () => {
      const conn: Connection = {
        id: 'conn-1',
        startNodeId: 'node-a',
        startPortId: 'p1',
        endNodeId: 'node-b',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 1, // Low bandwidth to trigger saturation
        throughputGbps: 0,
        latencyMs: 1
      }

      // Heavy ransomware demand (2.0 Gbps traffic spikes past 1.0 Gbps limits)
      const heavyNode = { ...nodeA, isInfected: true }
      const nodes = [heavyNode, nodeB]
      const demands = nodes.map(n => calculateNodeDemand(n, 0))
      const map = buildAdjacencyMap([conn])

      const { updatedConnections } = resolveCongestion(nodes, [conn], demands, map)
      const resolved = updatedConnections[0]!
      
      expect(resolved.packetLoss).toBeGreaterThan(0.0)
      expect(resolved.packetLoss).toBeLessThanOrEqual(1.0)
    })
  })

  describe('Dijkstra Shortest Path & Diagnostics Store Integration', () => {
    beforeEach(() => {
      useInfraStore.setState({
        nodes: [],
        connections: [],
        applications: [],
        alerts: []
      })
    })

    it('should calculate shortest path, compound latency, and compound packet loss', () => {
      const store = useInfraStore.getState()
      
      // Inject nodes into global store
      store.addNode(nodeA)
      store.addNode(nodeB)
      store.addNode(nodeC)

      // Inject connection A-B
      store.connections.push({
        id: 'conn-ab',
        startNodeId: 'node-a',
        startPortId: 'p1',
        endNodeId: 'node-b',
        endPortId: 'p2',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 1,
        latencyMs: 5,
        packetLoss: 0.05
      })

      // Inject connection B-C
      store.connections.push({
        id: 'conn-bc',
        startNodeId: 'node-b',
        startPortId: 'p3',
        endNodeId: 'node-c',
        endPortId: 'p4',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 1,
        latencyMs: 10,
        packetLoss: 0.1
      })

      const route = store.getNetworkRoute('node-a', 'node-c')
      expect(route.exists).toBe(true)
      expect(route.path).toEqual(['node-a', 'node-b', 'node-c'])
      expect(route.hops).toBe(2)
      expect(route.latencyMs).toBe(15.0) // 5 + 10
      // Compound loss formula: 1 - ((1 - 0.05) * (1 - 0.1)) = 1 - (0.95 * 0.9) = 1 - 0.855 = 0.145
      expect(route.packetLoss).toBeCloseTo(0.145, 4)
    })

    it('should steer packets dynamically around blocked links', () => {
      const store = useInfraStore.getState()
      
      store.addNode(nodeA)
      store.addNode(nodeB)
      store.addNode(nodeC)
      store.addNode(nodeD)

      // Primary Path: A -> B -> C
      // A-B is blocked
      store.connections.push({
        id: 'conn-ab',
        startNodeId: 'node-a',
        startPortId: 'p1',
        endNodeId: 'node-b',
        endPortId: 'p2',
        status: 'blocked',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 2,
        packetLoss: 1.0
      })

      store.connections.push({
        id: 'conn-bc',
        startNodeId: 'node-b',
        startPortId: 'p3',
        endNodeId: 'node-c',
        endPortId: 'p4',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 2,
        packetLoss: 0.0
      })

      // Redundant Path: A -> D -> C
      store.connections.push({
        id: 'conn-ad',
        startNodeId: 'node-a',
        startPortId: 'p5',
        endNodeId: 'node-d',
        endPortId: 'p6',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 6,
        packetLoss: 0.0
      })

      store.connections.push({
        id: 'conn-dc',
        startNodeId: 'node-d',
        startPortId: 'p7',
        endNodeId: 'node-c',
        endPortId: 'p8',
        status: 'active',
        bandwidthGbps: 10,
        throughputGbps: 0,
        latencyMs: 4,
        packetLoss: 0.0
      })

      const route = store.getNetworkRoute('node-a', 'node-c')
      expect(route.exists).toBe(true)
      // Must steer route around blocked A-B via A -> D -> C
      expect(route.path).toEqual(['node-a', 'node-d', 'node-c'])
      expect(route.latencyMs).toBe(10.0) // 6 + 4
      expect(route.packetLoss).toBe(0.0)
    })
  })
})
