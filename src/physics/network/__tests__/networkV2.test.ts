import { describe, it, expect } from 'vitest'
import { findShortestPath } from '../routing'
import { resolveCongestion } from '../congestion'
import { buildAdjacencyMap } from '../topology'
import type { InfraNode, Connection } from '../../../store/infraTypes'
import * as THREE from 'three'

describe('Enterprise Network V2 Systems Integration Tests', () => {
  const nodeA: InfraNode = {
    id: 'node-a',
    name: 'Compute A',
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
    name: 'Storage C',
    type: 'storage',
    siteId: 'site-1',
    position: new THREE.Vector3(2, 0, 0),
    systemState: 'running',
    healthStatus: 'healthy',
    degradation: 0,
    wattage: 600,
    ports: [],
    services: [],
    installDate: 0,
    backupStatus: 'unprotected',
    uHeight: 1,
    btuOutput: 0,
    bootProgress: 100,
    provisioningState: 'bootstrapped'
  }

  const nodes = [nodeA, nodeB, nodeC]

  it('should find shortest path using Dijkstra routing and prefer lower weight paths', () => {
    // Normal connections: Direct path A -> C (high latency), and Path A -> B -> C (low latency)
    const conn1: Connection = {
      id: 'conn-a-c',
      startNodeId: 'node-a',
      startPortId: 'p1',
      endNodeId: 'node-c',
      endPortId: 'p1',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 50.0, // High latency
      packetLoss: 0.0
    }

    const conn2: Connection = {
      id: 'conn-a-b',
      startNodeId: 'node-a',
      startPortId: 'p2',
      endNodeId: 'node-b',
      endPortId: 'p1',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 2.0, // Extremely low latency
      packetLoss: 0.0
    }

    const conn3: Connection = {
      id: 'conn-b-c',
      startNodeId: 'node-b',
      startPortId: 'p2',
      endNodeId: 'node-c',
      endPortId: 'p2',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 2.0, // Extremely low latency
      packetLoss: 0.0
    }

    const conns = [conn1, conn2, conn3]

    // Route from A to C
    const result = findShortestPath('node-a', 'node-c', nodes, conns)
    expect(result.exists).toBe(true)
    // Should choose path node-a -> node-b -> node-c since 2 + 2 = 4ms < 50ms
    expect(result.path).toEqual(['node-a', 'node-b', 'node-c'])
    expect(result.connectionIds).toEqual(['conn-a-b', 'conn-b-c'])
    expect(result.totalLatencyMs).toBe(4.0)
  })

  it('should steer path around congested or blackholed connection links', () => {
    // High-latency link but non-congested, vs low-latency link that is blackholed/blocked
    const conn1: Connection = {
      id: 'conn-a-c',
      startNodeId: 'node-a',
      startPortId: 'p1',
      endNodeId: 'node-c',
      endPortId: 'p1',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 15.0,
      packetLoss: 0.0
    }

    const conn2: Connection = {
      id: 'conn-a-b',
      startNodeId: 'node-a',
      startPortId: 'p2',
      endNodeId: 'node-b',
      endPortId: 'p1',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 2.0,
      packetLoss: 0.0,
      isBlackholed: true // ADMINISTRATIVE NULL ROUTE
    }

    const conn3: Connection = {
      id: 'conn-b-c',
      startNodeId: 'node-b',
      startPortId: 'p2',
      endNodeId: 'node-c',
      endPortId: 'p2',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 2.0,
      packetLoss: 0.0
    }

    const conns = [conn1, conn2, conn3]

    const result = findShortestPath('node-a', 'node-c', nodes, conns)
    expect(result.exists).toBe(true)
    // Should steer path directly to node-c because conn-a-b is blackholed
    expect(result.path).toEqual(['node-a', 'node-c'])
    expect(result.connectionIds).toEqual(['conn-a-c'])
    expect(result.totalLatencyMs).toBe(15.0)
  })

  it('should propagate ransomware laterally over active, non-blocked connections', () => {
    const infectedNodeA: InfraNode = {
      ...nodeA,
      isInfected: true
    }

    const healthyNodeB: InfraNode = {
      ...nodeB,
      isInfected: false
    }

    const conn: Connection = {
      id: 'conn-a-b',
      startNodeId: 'node-a',
      startPortId: 'p1',
      endNodeId: 'node-b',
      endPortId: 'p1',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 2.0,
      packetLoss: 0.0
    }

    const testNodes = [infectedNodeA, healthyNodeB]
    const conns = [conn]
    const adjMap = buildAdjacencyMap(conns)

    // Run congestion with dt = 100 to ensure high propagation chance
    const result = resolveCongestion(testNodes, conns, [], adjMap, 100.0)
    
    // Node B should be infected laterally over the network connection
    expect(result.newlyInfectedNodeIds).toContain('node-b')
  })

  it('should NOT propagate ransomware laterally if adjacent connection is blocked or blackholed', () => {
    const infectedNodeA: InfraNode = {
      ...nodeA,
      isInfected: true
    }

    const healthyNodeB: InfraNode = {
      ...nodeB,
      isInfected: false
    }

    const conn: Connection = {
      id: 'conn-a-b',
      startNodeId: 'node-a',
      startPortId: 'p1',
      endNodeId: 'node-b',
      endPortId: 'p1',
      bandwidthGbps: 10,
      throughputGbps: 0,
      latencyMs: 2.0,
      packetLoss: 0.0,
      isBlackholed: true // blocked / blackholed!
    }

    const testNodes = [infectedNodeA, healthyNodeB]
    const conns = [conn]
    const adjMap = buildAdjacencyMap(conns)

    const result = resolveCongestion(testNodes, conns, [], adjMap, 100.0)
    
    // Node B should NOT be infected because the link is blackholed/offline
    expect(result.newlyInfectedNodeIds).not.toContain('node-b')
  })
})
