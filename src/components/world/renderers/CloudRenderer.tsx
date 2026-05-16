import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text, Float, Edges } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'

const CLOUD_GATEWAY_POS = new THREE.Vector3(18, 3, 0)

// Fixed random-ish positions to ensure render purity
const CLOUD_POSITIONS: [number, number, number][] = [
  [-1.2, 0.8, 1.5], [1.5, 1.2, -1.0], [-0.8, 0.5, -1.8], [0.9, 2.1, 0.7],
  [-2.1, 1.5, 0.2], [1.8, 0.6, 1.9], [-1.5, 2.3, -0.5], [0.4, 0.9, -2.2],
  [2.2, 1.8, -0.1], [-0.3, 2.5, 1.2], [1.1, 0.4, 0.8], [-1.9, 1.1, -1.4]
]

function CloudParticle({ offset }: { offset: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() + offset
    ref.current.position.y = Math.sin(t * 0.8) * 0.3
    ref.current.position.x = Math.cos(t * 0.5 + offset) * 0.4
    ref.current.position.z = Math.sin(t * 0.6 + offset * 2) * 0.4
    const mat = ref.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.4 + Math.sin(t * 1.5) * 0.3
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color="#7dd3fc" transparent depthWrite={false} />
    </mesh>
  )
}

export function CloudRenderer() {
  const { cloudLinks } = useInfraStore()
  const hasActiveLinks = cloudLinks.length > 0
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.3
    }
  })

  return (
    <group position={[CLOUD_GATEWAY_POS.x, CLOUD_GATEWAY_POS.y, CLOUD_GATEWAY_POS.z]}>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[3, 3.5, 0.3, 32]} />
        <meshStandardMaterial color="#0c4a6e" metalness={0.6} roughness={0.3} transparent opacity={0.7} />
        <Edges color="#38bdf8" />
      </mesh>

      <mesh ref={ringRef} position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.8, 0.03, 8, 64]} />
        <meshBasicMaterial color={hasActiveLinks ? '#38bdf8' : '#475569'} />
      </mesh>

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5}>
        <group position={[0, 0.4, 0]}>
          <mesh>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.5, -0.1, 0]}>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.8} />
          </mesh>
          <mesh position={[-0.5, -0.1, 0]}>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.3} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.2} transparent opacity={0.7} />
          </mesh>
        </group>
      </Float>

      {CLOUD_POSITIONS.map((pos, i) => (
        <group key={i} position={pos}>
          <CloudParticle offset={i * 1.3} />
        </group>
      ))}

      <pointLight color="#38bdf8" distance={10} intensity={hasActiveLinks ? 3 : 1} />

      <Text position={[0, 1.5, 0]} fontSize={0.35} color="#7dd3fc" outlineColor="#0c4a6e" outlineWidth={0.02}>
        CLOUD REGION
      </Text>

      {hasActiveLinks && (
        <Text position={[0, -1, 0]} fontSize={0.18} color="#94a3b8">
          {cloudLinks.length} Active Tier{cloudLinks.length > 1 ? 's' : ''}
        </Text>
      )}
    </group>
  )
}
