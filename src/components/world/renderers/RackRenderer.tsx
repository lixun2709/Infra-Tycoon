import { Edges, Text } from '@react-three/drei'
import type { ReactNode } from 'react'
import type { InfraNode } from '../../../store/infraTypes'

import * as THREE from 'three'

export const RACK_HEIGHT = 2.1
const RACK_U = 42
export const U_WORLD = RACK_HEIGHT / RACK_U

// Global Cached Resources for Racks
const rackChassisGeometry = new THREE.BoxGeometry(1, RACK_HEIGHT, 1)

// U-Slot Lines Geometry
const uSlotGeometry = new THREE.BufferGeometry()
const slotPoints: number[] = []
for (let j = 1; j <= RACK_U; j++) {
  const y = -RACK_HEIGHT / 2 + j * U_WORLD
  slotPoints.push(-0.501, y, 0.502)
  slotPoints.push(0.501, y, 0.502)
}
uSlotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(slotPoints, 3))
const uSlotMaterial = new THREE.LineBasicMaterial({ color: '#48afbb', transparent: true, opacity: 0.3 })

function USlotLines() {
  return <lineSegments geometry={uSlotGeometry} material={uSlotMaterial} />
}

export function RackRenderer({ 
  node, 
  isSelected, 
  onSelect, 
  children 
}: { 
  node: InfraNode; 
  isSelected: boolean; 
  onSelect: (id: string) => void; 
  children?: ReactNode 
}) {
  const status = node.status ?? 'online'
  const isOverload = status === 'power_overload'

  const currentW = node.currentPowerKW ?? 0
  const maxW = node.maxPowerKW ?? 5.0
  const powerText = `${currentW.toFixed(1)} / ${maxW.toFixed(1)} kW`

  return (
    <group position={[node.position.x, node.position.y + RACK_HEIGHT / 2, node.position.z]}>
      <mesh geometry={rackChassisGeometry} onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <meshStandardMaterial
          color={isOverload ? '#3b0a14' : '#2d3748'}
          emissive={isOverload ? '#ff0000' : '#000000'}
          emissiveIntensity={isOverload ? 0.8 : 0}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={isOverload ? 0.3 : 0.4}
          depthWrite={false}
        />
        <Edges 
          color={isSelected ? '#2dd4bf' : (isOverload ? '#ff4444' : '#f0f7fa')} 
          threshold={14} 
          lineWidth={isSelected ? 3 : 1.5} 
        />
      </mesh>

      <USlotLines />
      <Text 
        onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
        position={[0, RACK_HEIGHT / 2 + 0.15, 0]} 
        fontSize={0.1} 
        color={isOverload ? '#ff0000' : '#031225'} 
        outlineColor="#ffffff" 
        outlineWidth={0.01}
      >
        {node.name}
      </Text>
      <Text position={[0, RACK_HEIGHT / 2 + 0.02, 0]} fontSize={0.07} color={isOverload ? '#ff0000' : '#031225'} outlineColor="#ffffff" outlineWidth={0.005}>
        {powerText}
      </Text>
      {children}
    </group>
  )
}
