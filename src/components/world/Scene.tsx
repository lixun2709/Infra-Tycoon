import { Edges, Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, type ReactNode } from 'react'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import type { InfraNode } from '../../store/useInfraStore'
import { useInfraStore } from '../../store/useInfraStore'

/** Visual height for a 42U rack; 1U = this / 42 in world units. */
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

  const z = 0.502
  return (
    <>
      {segments.map(({ key, y }) => (
        <Line
          key={key}
          points={[
            [-0.501, y, z],
            [0.501, y, z],
          ]}
          color="#48afbb"
          lineWidth={1}
          opacity={0.45}
          transparent
        />
      ))}
    </>
  )
}

function MountedUnit({
  node,
  isSelected,
  onSelect,
}: {
  node: InfraNode
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  if (node.slotIndex == null || node.parentRackId == null) return null
  const color =
    node.catalogKey != null
      ? HARDWARE_CATALOG[node.catalogKey].color
      : TYPE_ACCENT[node.type] ?? '#718096'

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)
  const compactLabel = node.name
    .replace('Compute (1U)', 'Compute 1U')
    .replace('NetApp Shelf (2U)', 'NetApp 2U')
    .replace('Rubrik Node (2U)', 'Rubrik 2U')
  const labelFontSize = Math.min(0.032, Math.max(0.016, h * 0.32))

  return (
    <group position={[0, y, 0.02]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect(node.id)
        }}
      >
        <boxGeometry args={[0.92, h, 0.88]} />
        <meshStandardMaterial
          color={isSelected ? '#199277' : color}
          metalness={0.35}
          roughness={0.45}
          emissive={isSelected ? '#0b4f40' : '#000000'}
          emissiveIntensity={isSelected ? 0.28 : 0}
        />
        <Edges color="#f7fafc" threshold={20} lineWidth={1} />
        {isSelected && <Edges color="#ffffff" threshold={1} lineWidth={2.2} />}
      </mesh>
      <Text
        position={[0, 0, 0.485]}
        fontSize={labelFontSize}
        color="#ffffff"
        maxWidth={0.62}
        textAlign="center"
        lineHeight={0.9}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#0b1220"
        depthOffset={-1}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(node.id)
        }}
      >
        {compactLabel}
      </Text>
    </group>
  )
}

function Rack({ node, children }: { node: InfraNode; children?: ReactNode }) {
  const { position } = node
  const status = node.status ?? 'online'
  const maxPowerKW = node.maxPowerKW ?? 5.0
  const currentPowerKW = node.currentPowerKW ?? 0

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
          color={status === 'power_overload' ? '#3b0a14' : '#0c144d'}
          metalness={0.55}
          roughness={0.32}
          emissive={status === 'power_overload' ? '#ff2d2d' : '#1a6b7a'}
          emissiveIntensity={status === 'power_overload' ? 0.55 : 0.12}
        />
        <Edges color="#f0f7fa" threshold={14} lineWidth={1.5} />
      </mesh>
      <USlotLines />
      <Text
        position={[0, RACK_HEIGHT / 2 + 0.2, 0]}
        fontSize={0.12}
        color="#031225"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.016}
        outlineColor="#ffffff"
      >
        {node.name}
      </Text>
      <Text
        position={[0, RACK_HEIGHT / 2 + 0.1, 0]}
        fontSize={0.085}
        color={status === 'power_overload' ? '#7f1d1d' : '#082f49'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.014}
        outlineColor="#ffffff"
      >
        {`${currentPowerKW.toFixed(1)} / ${maxPowerKW.toFixed(1)} kW`}
      </Text>
      {children}
    </group>
  )
}

function World() {
  const nodes = useInfraStore((s) => s.nodes)
  const selectedNodeId = useInfraStore((s) => s.selectedNodeId)
  const setSelectedNode = useInfraStore((s) => s.setSelectedNode)
  const racks = useMemo(
    () => nodes.filter((n) => n.type === 'rack'),
    [nodes],
  )

  return (
    <>
      <color attach="background" args={['#e8eef2']} />
      <ambientLight intensity={0.92} />
      <directionalLight position={[10, 14, 8]} intensity={1.15} castShadow />
      <hemisphereLight args={['#f4f8fb', '#9eb4c4', 0.5]} position={[0, 20, 0]} />
      <gridHelper args={[30, 30, '#48afbb', '#b9c5cf']} />
      <OrbitControls makeDefault />
      {racks.map((rack) => {
        const mounted = nodes
          .filter((n) => n.parentRackId === rack.id)
          .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
        return (
          <Rack key={rack.id} node={rack}>
            {mounted.map((hw) => (
              <MountedUnit
                key={hw.id}
                node={hw}
                isSelected={selectedNodeId === hw.id}
                onSelect={setSelectedNode}
              />
            ))}
          </Rack>
        )
      })}
    </>
  )
}

export function Scene() {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [8, 6, 8], fov: 50 }}
      gl={{ antialias: true }}
      onPointerMissed={() => useInfraStore.getState().setSelectedNode(null)}
    >
      <World />
    </Canvas>
  )
}
