import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CoolingEffectProps {
  h: number
  isRunning: boolean
}

function CoolingEffectComponent({ isRunning }: CoolingEffectProps) {
  const ringRef1 = useRef<THREE.Mesh>(null)
  const ringRef2 = useRef<THREE.Mesh>(null)
  const ringRef3 = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!isRunning) return
    const time = clock.getElapsedTime()

    const refs = [ringRef1, ringRef2, ringRef3]
    refs.forEach((ref, index) => {
      if (!ref.current) return
      
      // Calculate age/phase of this specific ring (0 to 1 loop)
      const phase = (time * 0.7 + index * 0.33) % 1.0
      
      // Scale expands outward as it flows forward
      const scale = 0.3 + phase * 1.5
      ref.current.scale.set(scale, scale, 1)

      // Move forward out of the front panel
      ref.current.position.z = 0.46 + phase * 0.8

      // Add gentle vertical waving motion to simulate natural air currents
      ref.current.position.y = Math.sin(time * 3 + index) * 0.04

      // Fade out smoothly as it travels
      const mat = ref.current.material as THREE.MeshBasicMaterial
      if (mat) {
        mat.opacity = Math.max(0, 0.4 * (1 - phase) * Math.sin(phase * Math.PI))
      }
    })
  })

  if (!isRunning) return null

  return (
    <group>
      {/* Air Current Wave 1 */}
      <mesh ref={ringRef1} position={[0, 0, 0.46]}>
        <ringGeometry args={[0.22, 0.24, 32]} />
        <meshBasicMaterial color="#00f2ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Air Current Wave 2 */}
      <mesh ref={ringRef2} position={[0, 0, 0.46]}>
        <ringGeometry args={[0.22, 0.24, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Air Current Wave 3 */}
      <mesh ref={ringRef3} position={[0, 0, 0.46]}>
        <ringGeometry args={[0.22, 0.24, 32]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Front Panel Cooling Vent Indicator light */}
      <pointLight color="#00f2ff" distance={1.5} intensity={0.6} position={[0, 0, 0.48]} />
    </group>
  )
}

export const CoolingEffect = React.memo(CoolingEffectComponent)
