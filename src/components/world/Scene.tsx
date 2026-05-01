import { Edges, Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import type { InfraNode } from '../../store/useInfraStore'
import { useInfraStore } from '../../store/useInfraStore'
import { Cables } from './Cables'

export const RACK_HEIGHT = 2.1
const RACK_U = 42
const U_WORLD = RACK_HEIGHT / RACK_U

const TYPE_ACCENT: Record<string, string> = {
  compute: '#4a5568',
  storage: '#2b6cb0',
  backup: '#805ad5',
  network: '#2d3748',
}

function rackHardwareCenterY(slotIndex: number, uHeight: number): number {
  return -RACK_HEIGHT / 2 + U_WORLD * (slotIndex - 1 + uHeight / 2)
}

function USlotLines() {
  const segments = useMemo(() => {
    const out: { key: number; y: number }[] = []
    for (let j = 1; j <= RACK_U; j++) {
      const y = -RACK_HEIGHT / 2 + j * U_WORLD
      out.push({ key: j, y })
    }
    return out
  }, [])

  return (
    <>
      {segments.map(({ key, y }) => (
        <Line
          key={key}
          points={[[-0.501, y, 0.502], [0.501, y, 0.502]]}
          color="#48afbb"
          lineWidth={1}
          opacity={0.3}
          transparent
        />
      ))}
    </>
  )
}

function MountedUnit({ node, isSelected, onSelect }: { node: InfraNode, isSelected: boolean, onSelect: (id: string) => void }) {
  if (node.slotIndex == null || node.parentRackId == null) return null
  const color = node.catalogKey != null ? HARDWARE_CATALOG[node.catalogKey].color : TYPE_ACCENT[node.type] ?? '#718096'

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)

  return (
    <group position={[0, y, 0.1]}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.92, h, 0.88]} />
        <meshStandardMaterial
          color={isSelected ? '#199277' : color}
          metalness={0.4}
          roughness={0.4}
          emissive={isSelected ? '#2dd4bf' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
        <Edges color={isSelected ? '#ffffff' : '#f7fafc'} threshold={20} lineWidth={isSelected ? 2 : 1} />
      </mesh>
      <Text position={[0, 0, 0.485]} fontSize={0.025} color="#ffffff" outlineWidth={0.005} outlineColor="#000000">
        {node.name}
      </Text>
    </group>
  )
}

function Rack({ node, isSelected, onSelect, children }: { node: InfraNode; isSelected: boolean, onSelect: (id: string) => void; children?: ReactNode }) {
  const status = node.status ?? 'online'
  const isOverload = status === 'power_overload'
  
  const currentW = node.currentPowerKW ?? 0
  const maxW = node.maxPowerKW ?? 5.0
  const powerText = `${currentW.toFixed(1)} / ${maxW.toFixed(1)} kW`

  return (
    <group position={[node.position.x, node.position.y + RACK_HEIGHT / 2, node.position.z]}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[1, RACK_HEIGHT, 1]} />
        <meshStandardMaterial 
          color={isOverload ? '#3b0a14' : '#0c144d'} 
          emissive={isOverload ? '#ff0000' : '#000000'}
          emissiveIntensity={isOverload ? 0.8 : 0}
          metalness={0.8} 
          roughness={0.2} 
          transparent 
          opacity={isOverload ? 0.3 : 0.15} 
          depthWrite={false}
        />
        <Edges color={isSelected ? '#2dd4bf' : (isOverload ? '#ff4444' : '#f0f7fa')} threshold={14} lineWidth={isSelected ? 3 : 1.5} />
      </mesh>
      <USlotLines />
      <Text position={[0, RACK_HEIGHT / 2 + 0.15, 0]} fontSize={0.1} color={isOverload ? '#ff0000' : '#031225'} outlineColor="#ffffff" outlineWidth={0.01}>
        {node.name}
      </Text>
      <Text position={[0, RACK_HEIGHT / 2 + 0.02, 0]} fontSize={0.07} color={isOverload ? '#ff0000' : '#031225'} outlineColor="#ffffff" outlineWidth={0.005}>
        {powerText}
      </Text>
      {children}
    </group>
  )
}

function Floor() {
  const { placementMode, pendingRackType, setPlacementMode, addNode } = useInfraStore()
  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null)

  return (
    <>
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        receiveShadow
        onPointerMove={(e) => {
          if (!placementMode) return
          // snap to nearest 1 unit
          const x = Math.round(e.point.x)
          const z = Math.round(e.point.z)
          setGhostPos(new THREE.Vector3(x, 0, z))
        }}
        onClick={(e) => {
          if (!placementMode || !ghostPos) {
            useInfraStore.getState().setSelectedNode(null)
            return
          }
          e.stopPropagation()
          addNode({
            id: crypto.randomUUID(),
            type: 'rack',
            position: ghostPos.clone(),
            name: `Rack-${Math.floor(Math.random() * 1000)}`,
            uHeight: 42,
            wattage: 0,
            btuOutput: 0,
            maxPowerKW: 5.0,
            currentPowerKW: 0,
            status: 'online',
            ports: [],
          })
          setPlacementMode(false, null)
          setGhostPos(null)
        }}
      >
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      
      {placementMode && ghostPos && (
        <group position={[ghostPos.x, ghostPos.y + RACK_HEIGHT / 2, ghostPos.z]}>
          <mesh>
             <boxGeometry args={[1, RACK_HEIGHT, 1]} />
             <meshStandardMaterial color="#199277" transparent opacity={0.5} />
             <Edges color="#2dd4bf" />
          </mesh>
        </group>
      )}
    </>
  )
}

function World() {
  const { nodes, selectedNodeId, setSelectedNode } = useInfraStore()
  const racks = useMemo(() => nodes.filter(n => n.type === 'rack'), [nodes])

  return (
    <>
      <color attach="background" args={['#e8eef2']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <gridHelper args={[30, 30, '#48afbb', '#b9c5cf']} />
      <OrbitControls makeDefault />

      <Floor />
      <Cables />

      {racks.map((rack) => (
        <Rack 
          key={rack.id} 
          node={rack}
          isSelected={selectedNodeId === rack.id}
          onSelect={setSelectedNode}
        >
          {nodes.filter(n => n.parentRackId === rack.id).map(hw => (
            <MountedUnit
              key={hw.id}
              node={hw}
              isSelected={selectedNodeId === hw.id}
              onSelect={setSelectedNode}
            />
          ))}
        </Rack>
      ))}
    </>
  )
}

export function Scene() {
  return (
    <Canvas className="h-full w-full" camera={{ position: [5, 4, 5], fov: 45 }} onPointerMissed={() => useInfraStore.getState().setSelectedNode(null)}>
      <World />
    </Canvas>
  )
}