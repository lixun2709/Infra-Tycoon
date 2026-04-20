import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { Vector3 } from 'three'
import { useInfraStore } from '../../store/useInfraStore'

/** Box height; mesh origin is center — offset so base sits on floor (y = position.y). */
const RACK_HEIGHT = 2.1

function Rack({ position }: { position: Vector3 }) {
  return (
    <group
      position={[
        position.x,
        position.y + RACK_HEIGHT / 2,
        position.z,
      ]}
    >
      <mesh>
        <boxGeometry args={[1, RACK_HEIGHT, 1]} />
        <meshStandardMaterial
          color="#0c144d"
          metalness={0.55}
          roughness={0.32}
          emissive="#1a6b7a"
          emissiveIntensity={0.12}
        />
        <Edges color="#f0f7fa" threshold={14} lineWidth={1.5} />
      </mesh>
    </group>
  )
}

function World() {
  const nodes = useInfraStore((s) => s.nodes)

  return (
    <>
      <color attach="background" args={['#e8eef2']} />
      <ambientLight intensity={0.92} />
      <directionalLight position={[10, 14, 8]} intensity={1.15} castShadow />
      <hemisphereLight args={['#f4f8fb', '#9eb4c4', 0.5]} position={[0, 20, 0]} />
      <gridHelper args={[30, 30, '#48afbb', '#b9c5cf']} />
      <OrbitControls makeDefault />
      {nodes
        .filter((n) => n.type === 'rack')
        .map((node) => (
          <Rack key={node.id} position={node.position} />
        ))}
    </>
  )
}

export function Scene() {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [8, 6, 8], fov: 50 }}
      gl={{ antialias: true }}
    >
      <World />
    </Canvas>
  )
}
