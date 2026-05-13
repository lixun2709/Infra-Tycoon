import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface StatusLEDProps {
  portStatus?: string
  connStatus?: string
  otherNodeExists: boolean
  isSelected: boolean
}

function StatusLEDComponent({ portStatus, connStatus, otherNodeExists, isSelected }: StatusLEDProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const isNegotiating = portStatus === 'negotiating'
  const isActive = connStatus === 'active' && otherNodeExists && !isNegotiating
  const isBlocked = connStatus === 'blocked' && otherNodeExists

  useFrame(({ clock }) => {
    if (matRef.current) {
      if (isNegotiating) {
        const flicker = Math.sin(clock.elapsedTime * 30) > 0 ? 8.0 : 0.0
        matRef.current.color.set('#f59e0b')
        matRef.current.emissive.set('#f59e0b')
        matRef.current.emissiveIntensity = flicker
      } else if (isActive) {
        const flicker = 10.0 + Math.random() * 20.0
        matRef.current.color.set('#22c55e')
        matRef.current.emissive.set('#22c55e')
        matRef.current.emissiveIntensity = flicker
      } else if (isBlocked) {
        matRef.current.color.set('#ef4444')
        matRef.current.emissive.set('#ef4444')
        matRef.current.emissiveIntensity = 8.0
      } else {
        matRef.current.color.set('#1e293b')
        matRef.current.emissive.set('#000000')
        matRef.current.emissiveIntensity = 0
      }
    }
  })

  return (
    <group position={[0.005, 0.005, 0.003]}>
      <mesh>
        <sphereGeometry args={[0.002, 8, 8]} />
        <meshStandardMaterial ref={matRef} metalness={1} roughness={0} />
      </mesh>
      {isSelected && (isActive || isNegotiating) && (
        <pointLight 
          color={isNegotiating ? '#f59e0b' : '#22c55e'} 
          distance={0.05} 
          intensity={0.5} 
        />
      )}
    </group>
  )
}

export const StatusLED = React.memo(StatusLEDComponent)
