import { useState, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import { RACK_HEIGHT, U_WORLD } from '../../../physics/dimensions'

export function OverlayRenderer() {
  const isChaosMode = useInfraStore(s => s.isChaosMode)
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!meshRef.current || !isChaosMode) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.02 + Math.sin(clock.elapsedTime * 8) * 0.015 + (Math.sin(clock.elapsedTime * 50) * 0.5 + 0.5) * 0.01
  })

  if (!isChaosMode) return null

  return (
    <mesh ref={meshRef} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshBasicMaterial color="#ff0000" transparent opacity={0.03} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function BlueprintPreview() {
  const { previewBlueprintId, blueprints } = useInfraStore()
  const blueprint = blueprints.find(b => b.id === previewBlueprintId)
  if (!blueprint) return null

  const racks = blueprint.nodes.filter(n => n.type === 'rack')

  return (
    <group>
      {racks.map(rack => (
        <group key={`preview-${rack.id}`} position={[rack.position.x, rack.position.y + RACK_HEIGHT / 2, rack.position.z]}>
          <mesh>
            <boxGeometry args={[1.05, RACK_HEIGHT + 0.05, 1.05]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.15} wireframe />
          </mesh>
          {blueprint.nodes.filter(n => n.parentRackId === rack.id).map(hw => {
            const h = hw.uHeight * U_WORLD
            const yOffset = -RACK_HEIGHT / 2 + U_WORLD * (hw.slotIndex! - 1 + hw.uHeight / 2)
            return (
              <mesh key={`preview-hw-${hw.id}`} position={[0, yOffset, 0]}>
                <boxGeometry args={[0.92, h - 0.01, 0.92]} />
                <meshStandardMaterial color="#60a5fa" transparent opacity={0.3} emissive="#60a5fa" emissiveIntensity={0.5} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

export function DeployWave() {
  const [active, setActive] = useState(false)
  const [scale, setScale] = useState(0)
  const prevNodesCount = useRef(0)
  const nodes = useInfraStore(s => s.nodes)

  useEffect(() => {
    if (nodes.length > prevNodesCount.current + 3) {
      setActive(true)
      setScale(0)
    }
    prevNodesCount.current = nodes.length
  }, [nodes.length])

  useFrame((_, delta) => {
    if (active) {
      setScale(s => {
        if (s > 40) {
          setActive(false)
          return 0
        }
        return s + delta * 25
      })
    }
  })

  if (!active) return null

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[scale, scale + 2, 64]} />
      <meshBasicMaterial color="#10b981" transparent opacity={0.4 * (1 - scale / 40)} />
    </mesh>
  )
}
