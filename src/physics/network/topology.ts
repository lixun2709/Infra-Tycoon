import type { Connection } from '../../store/infraTypes'
import type { AdjacencyMap } from './types'

/**
 * buildAdjacencyMap
 * Pre-builds O(1) link queries, eliminating complex O(N2) path lookups.
 */
export function buildAdjacencyMap(connections: Connection[]): AdjacencyMap {
  const nodeToConnections = new Map<string, string[]>()
  const connectionMap = new Map<string, Connection>()

  for (const conn of connections) {
    if (!conn || !conn.id || !conn.startNodeId || !conn.endNodeId) continue
    if (conn.startNodeId === conn.endNodeId) continue // Skip self-loops

    connectionMap.set(conn.id, conn)

    if (!nodeToConnections.has(conn.startNodeId)) {
      nodeToConnections.set(conn.startNodeId, [])
    }
    nodeToConnections.get(conn.startNodeId)!.push(conn.id)

    if (!nodeToConnections.has(conn.endNodeId)) {
      nodeToConnections.set(conn.endNodeId, [])
    }
    nodeToConnections.get(conn.endNodeId)!.push(conn.id)
  }

  return { nodeToConnections, connectionMap }
}
