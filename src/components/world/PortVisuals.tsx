/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import type { InfraNode } from '../../store/infraTypes'
import { StatusLED } from './StatusLED'

interface PortVisualsProps {
  node: InfraNode
  h: number
  onSelect: (id: string) => void
}

function PortVisualsComponent({ node, h, onSelect }: PortVisualsProps) {
  const { handlePortClick, activePatchSource, selectedNodeId, connections, nodes } = useInfraStore(useShallow(state => ({
    handlePortClick: state.handlePortClick,
    activePatchSource: state.activePatchSource,
    selectedNodeId: state.selectedNodeId,
    connections: state.connections,
    nodes: state.nodes
  })))
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null)
  const isSelected = selectedNodeId === node.id
  
  const scheme = useMemo(() => {
    switch(node.type) {
      case 'network': return { panel: '#0f172a', bezel: '#334155' }
      case 'storage': return { panel: '#1e3a8a', bezel: '#1e40af' }
      case 'compute': return { panel: '#171717', bezel: '#404040' }
      case 'security': return { panel: '#450a0a', bezel: '#7f1d1d' }
      default: return { panel: '#1a1a1a', bezel: '#262626' }
    }
  }, [node.type])

  const sortedPorts = useMemo(() => [...node.ports].sort((a, b) => {
    if (a.type === 'power' && b.type !== 'power') return -1
    if (a.type !== 'power' && b.type === 'power') return 1
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  }), [node.ports])

  return (
    <group position={[0, 0, -0.455]} rotation={[0, Math.PI, 0]}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.91, h * 0.92, 0.01]} />
        <meshStandardMaterial color={scheme.bezel} metalness={1} roughness={0.1} />
      </mesh>

      <mesh position={[0, 0, 0.004]} onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.88, h * 0.88, 0.002]} />
        <meshStandardMaterial color={scheme.panel} metalness={0.5} roughness={0.8} />
      </mesh>

      <group position={[0, 0, 0.01]}>
        {sortedPorts.map((port, idx) => {
          const portCount = sortedPorts.length
          const isHighDensity = portCount > 12
          const portsPerRow = isHighDensity ? (portCount <= 24 ? 12 : 24) : 8
          const rowCount = Math.ceil(portCount / portsPerRow)
          const row = Math.floor(idx / portsPerRow)
          const col = idx % portsPerRow
          const portsInThisRow = (row === rowCount - 1) ? (portCount % portsPerRow || portsPerRow) : portsPerRow
          
          const totalWidth = 0.88
          const spacingX = isHighDensity ? (totalWidth / (portsPerRow - 1)) * 0.95 : (portsInThisRow > 1 ? totalWidth / (portsInThisRow - 1) * 0.9 : 0.1)
          const spacingY = isHighDensity ? 0.025 : 0.045
          const portSize = isHighDensity ? 0.009 : 0.014
          
          const x = portsInThisRow > 1 ? (col - (portsInThisRow - 1) / 2) * spacingX : 0
          const y = (rowCount > 1) ? (row - (rowCount - 1) / 2) * -spacingY : 0

          const isSource = activePatchSource?.nodeId === node.id && activePatchSource?.portId === port.id
          const conn = connections.find((c: any) => (c.startNodeId === node.id && c.startPortId === port.id) || (c.endNodeId === node.id && c.endPortId === port.id))
          const isPlugged = port.connectedTo !== null || isSource

          return (
            <group key={port.id} position={[x, y, 0]}>
              <mesh position={[0, 0, -0.003]}>
                <boxGeometry args={[portSize * 1.2, portSize * 1.2, 0.006]} />
                <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
              </mesh>

              <mesh 
                onPointerOver={() => setHoveredPortId(port.id)}
                onPointerOut={() => setHoveredPortId(null)}
                onClick={(e) => { e.stopPropagation(); handlePortClick(node.id, port.id); }}
                position={[0, 0, 0.001]}
              >
                <boxGeometry args={[portSize, portSize, 0.004]} />
                <meshStandardMaterial 
                  color={isPlugged ? "#00f2ff" : "#f59e0b"} 
                  metalness={1} roughness={0.1} 
                  emissive={isPlugged ? "#00f2ff" : "#f59e0b"}
                  emissiveIntensity={isPlugged ? 5.0 : 0.8}
                />
              </mesh>
              
              <Text position={[0, portSize * 0.6 + 0.003, 0.005]} fontSize={isHighDensity ? 0.0035 : 0.006} color="#94a3b8" anchorX="center" anchorY="bottom">
                {port.label}
              </Text>

              {hoveredPortId === port.id && (
                <Billboard position={[0, 0.04, 0.05]} follow={true}>
                  <mesh position={[0, 0, -0.01]}>
                    <planeGeometry args={[0.08, 0.02]} />
                    <meshBasicMaterial color="#000000" transparent opacity={0.8} />
                  </mesh>
                  <Text fontSize={0.012} color="#00f2ff">
                    {port.label.toUpperCase()}
                  </Text>
                </Billboard>
              )}

              <StatusLED 
                portStatus={port.status} 
                connStatus={conn?.status} 
                otherNodeExists={!!conn && nodes.some((n: any) => n.id === (conn.startNodeId === node.id ? conn.endNodeId : conn.startNodeId))}
                isSelected={isSelected} 
              />
            </group>
          )
        })}
      </group>
    </group>
  )
}

export const PortVisuals = React.memo(PortVisualsComponent)

