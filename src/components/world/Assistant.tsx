import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Text, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'
import { useInfraStore } from '../../store/useInfraStore'

export const Assistant: React.FC = () => {
  const { assistantTargetId, nodes, isAutoPilot } = useInfraStore()
  const droidRef = useRef<THREE.Group>(null)
  
  const targetNode = useMemo(() => {
    if (!assistantTargetId) return null
    return nodes.find(n => n.id === assistantTargetId)
  }, [assistantTargetId, nodes])

  useFrame(({ clock }) => {
    if (!droidRef.current) return
    
    const t = clock.elapsedTime
    
    if (targetNode) {
      const targetPos = new THREE.Vector3(targetNode.position.x, targetNode.position.y + 3, targetNode.position.z)
      droidRef.current.position.lerp(targetPos, 0.05)
    } else {
      // Idle floating
      droidRef.current.position.y = 5 + Math.sin(t * 0.5) * 0.5
      droidRef.current.position.x = Math.sin(t * 0.3) * 5
      droidRef.current.position.z = Math.cos(t * 0.3) * 5
    }

    droidRef.current.rotation.y += 0.01
    droidRef.current.rotation.z += 0.005
  })

  return (
    <group ref={droidRef}>
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <mesh>
          <tetrahedronGeometry args={[0.3]} />
          <meshStandardMaterial 
            color="#2dd4bf" 
            emissive="#2dd4bf" 
            emissiveIntensity={2} 
            wireframe 
          />
        </mesh>
        <pointLight color="#2dd4bf" distance={5} intensity={2} />
        
        {isAutoPilot && (
          <Text
            position={[0, 0.5, 0]}
            fontSize={0.15}
            color="#2dd4bf"
            outlineColor="#000000"
            outlineWidth={0.02}
          >
            AUTO-PILOT ACTIVE
          </Text>
        )}
      </Float>

      {targetNode && (
        <QuadraticBezierLine
          start={[0, 0, 0]}
          end={[0, -3, 0]}
          mid={[0.5, -1.5, 0.5]}
          color="#2dd4bf"
          lineWidth={1.5}
          transparent
          opacity={0.6}
        />
      )}
    </group>
  )
}
