import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { InfraNode } from '../../store/useInfraStore'

interface CoolingFanProps {
  position: [number, number, number]
  nodeId: string
  currentPowerKW: number
  maxPowerKW: number
  h: number
}

function CoolingFanComponent({ position, currentPowerKW, maxPowerKW, h }: CoolingFanProps) {
  const meshRef = useRef<THREE.Group>(null)
  const powerFactor = (currentPowerKW || 0) / (maxPowerKW || 1)
  const speed = 15 + (powerFactor * 60)
  const fanSize = h * 0.4
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.z += clock.getDelta() * speed * 1.5
    meshRef.current.position.x = Math.sin(clock.elapsedTime * 50) * 0.0005
    meshRef.current.position.y = Math.cos(clock.elapsedTime * 45) * 0.0005
  })

  return (
    <group position={position}>
      {/* Outer Ring / Shroud */}
      <mesh>
        <torusGeometry args={[fanSize, 0.01, 8, 32]} />
        <meshStandardMaterial color="#475569" metalness={1} roughness={0.1} />
      </mesh>
      
      {/* Protective Grill */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[fanSize, 12]} />
        <meshStandardMaterial color="#94a3b8" wireframe transparent opacity={0.3} />
      </mesh>

      {/* Spinning Blades */}
      <group ref={meshRef}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
            <planeGeometry args={[fanSize * 0.4, fanSize * 1.6]} />
            <meshStandardMaterial 
              color="#64748b" 
              metalness={1} 
              roughness={0.2} 
              emissive="#334155"
              emissiveIntensity={0.8}
              side={THREE.DoubleSide} 
            />
          </mesh>
        ))}
      </group>

      {/* Center Hub */}
      <mesh position={[0, 0, 0.015]}>
        <cylinderGeometry args={[fanSize * 0.2, fanSize * 0.25, 0.02, 16]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#94a3b8" metalness={1} roughness={0.1} />
      </mesh>

      {/* Active Power LED */}
      <mesh position={[fanSize * 0.6, fanSize * 0.6, 0.02]}>
        <sphereGeometry args={[0.008, 12, 12]} />
        <meshStandardMaterial 
          color="#22c55e" 
          emissive="#22c55e" 
          emissiveIntensity={4} 
        />
        <pointLight color="#22c55e" distance={0.1} intensity={1} />
      </mesh>
    </group>
  )
}

export const CoolingFan = React.memo(CoolingFanComponent, (prev, next) => {
  return prev.currentPowerKW === next.currentPowerKW && 
         prev.maxPowerKW === next.maxPowerKW && 
         prev.h === next.h
})
