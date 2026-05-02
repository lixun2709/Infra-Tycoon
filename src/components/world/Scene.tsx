import { Edges, Line, OrbitControls, Text, Grid, Float } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
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
  const healthColor = node.isInfected ? '#d946ef' : node.healthStatus === 'critical' ? '#ef4444' : node.healthStatus === 'degraded' ? '#eab308' : '#22c55e'

  return (
    <group position={[0, y, 0.1]}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.92, h, 0.88]} />
        <meshStandardMaterial
          color={isSelected ? '#199277' : node.isInfected ? '#4a044e' : color}
          metalness={0.4}
          roughness={0.4}
          emissive={isSelected ? '#2dd4bf' : node.isInfected ? '#d946ef' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : node.isInfected ? 0.5 : 0}
        />
        <Edges color={isSelected ? '#ffffff' : '#f7fafc'} threshold={20} lineWidth={isSelected ? 2 : 1} />
      </mesh>

      <mesh position={[0.4, 0, 0.445]}>
         <sphereGeometry args={[0.02, 16, 16]} />
         <meshStandardMaterial color={healthColor} emissive={healthColor} emissiveIntensity={0.8} />
      </mesh>

      {node.isImmutable && (
        <group position={[0, h/2 + 0.04, 0.45]}>
          <Text fontSize={0.06} color="#60a5fa" outlineColor="#1e3a8a" outlineWidth={0.01}>🛡️</Text>
          <pointLight color="#60a5fa" distance={0.5} intensity={0.5} />
        </group>
      )}

      {/* AI At-Risk Orange Aura */}
      {(node.failureProbability ?? 0) > 0.6 && !node.isInfected && (
        <group>
          <pointLight 
            color="#f97316" 
            distance={1.5} 
            intensity={(node.failureProbability ?? 0) * 3}
          />
          <mesh>
            <boxGeometry args={[1.0, h + 0.1, 0.96]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.08} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* Migration indicator */}
      {node.activeMigration && (
        <group position={[0, h/2 + 0.08, 0.45]}>
          <Text fontSize={0.05} color="#ffffff" outlineColor="#000000" outlineWidth={0.01}>
            ⚡ {node.activeMigration.progress}%
          </Text>
        </group>
      )}

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

function WanGatewayPanel() {
  const { connections, nodes } = useInfraStore()
  
  // A link is interrupted if any node in a WAN connection is critical
  const isInterrupted = connections.some(conn => {
    const startNode = nodes.find(n => n.id === conn.startNodeId)
    const endNode = nodes.find(n => n.id === conn.endNodeId)
    if (!startNode || !endNode) return false
    const isWan = startNode.siteId !== endNode.siteId
    if (!isWan) return false
    
    return startNode.healthStatus === 'critical' || endNode.healthStatus === 'critical'
  })

  return (
    <group position={[0, 10, -15.1]}>
      <mesh>
        <boxGeometry args={[4, 1.5, 0.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
        <Edges color="#475569" />
      </mesh>
      
      {/* Ports Array */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-1.4 + i * 0.4, 0, 0.15]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={isInterrupted ? '#ef4444' : '#a855f7'} />
        </mesh>
      ))}

      {/* Pulse Effect */}
      {isInterrupted && (
        <mesh position={[0, 0, 0.2]}>
          <planeGeometry args={[4.2, 1.7]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}
      
      {/* Light Source */}
      <pointLight 
        position={[0, 0, 1]} 
        color={isInterrupted ? '#ef4444' : '#a855f7'} 
        distance={8} 
        intensity={isInterrupted ? 2 : 1} 
      />

      <Text position={[0, 1.2, 0]} fontSize={0.4} color={isInterrupted ? '#ef4444' : '#e2e8f0'} outlineColor="#000000" outlineWidth={0.02}>
        WAN GATEWAY
      </Text>
    </group>
  )
}

const CLOUD_GATEWAY_POS = new THREE.Vector3(18, 3, 0)
export { CLOUD_GATEWAY_POS }

function CloudParticle({ offset }: { offset: number }) {
  const ref = useRef<THREE.Mesh>(null)
  
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() + offset
    ref.current.position.y = Math.sin(t * 0.8) * 0.3
    ref.current.position.x = Math.cos(t * 0.5 + offset) * 0.4
    ref.current.position.z = Math.sin(t * 0.6 + offset * 2) * 0.4
    ;(ref.current.material as any).opacity = 0.4 + Math.sin(t * 1.5) * 0.3
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color="#7dd3fc" transparent depthWrite={false} />
    </mesh>
  )
}

function CloudGateway() {
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
      {/* Platform base */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[3, 3.5, 0.3, 32]} />
        <meshStandardMaterial color="#0c4a6e" metalness={0.6} roughness={0.3} transparent opacity={0.7} />
        <Edges color="#38bdf8" />
      </mesh>

      {/* Glowing ring */}
      <mesh ref={ringRef} position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.8, 0.03, 8, 64]} />
        <meshBasicMaterial color={hasActiveLinks ? '#38bdf8' : '#475569'} />
      </mesh>

      {/* Cloud Icon - layered spheres */}
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
      
      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <group key={i} position={[(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2 + 0.5, (Math.random() - 0.5) * 4]}>
          <CloudParticle offset={i * 1.3} />
        </group>
      ))}

      {/* Point light */}
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

function CameraAnimator() {
  const { controls } = useThree()
  const { selectedNodeId, nodes } = useInfraStore()
  const [isManualOverride, setIsManualOverride] = useState(false)
  
  useEffect(() => {
    setIsManualOverride(false)
  }, [selectedNodeId])

  useEffect(() => {
    if (!controls) return
    const handleStart = () => setIsManualOverride(true)
    controls.addEventListener('start', handleStart)
    return () => controls.removeEventListener('start', handleStart)
  }, [controls])

  useFrame((state, delta) => {
    if (!selectedNodeId || isManualOverride || !controls) return

    const selectedNode = nodes.find(n => n.id === selectedNodeId)
    if (!selectedNode) return

    let targetPos = new THREE.Vector3(selectedNode.position.x, selectedNode.position.y, selectedNode.position.z)
    
    if (selectedNode.parentRackId) {
      const rack = nodes.find(n => n.id === selectedNode.parentRackId)
      if (rack) {
        const yOffset = -RACK_HEIGHT / 2 + (RACK_HEIGHT / 42) * ((selectedNode.slotIndex ?? 1) - 1 + selectedNode.uHeight / 2)
        targetPos.set(rack.position.x, rack.position.y + RACK_HEIGHT / 2 + yOffset, rack.position.z)
      }
    } else if (selectedNode.type === 'rack') {
       targetPos.y += RACK_HEIGHT / 2
    }

    (controls as any).target.lerp(targetPos, delta * 4)
    controls.update()
  })

  return null
}

function World() {
  const { nodes, selectedNodeId, setSelectedNode, totalRoomBTU, currentSiteId } = useInfraStore()
  const racks = useMemo(() => nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId), [nodes, currentSiteId])
  const hardwareNodes = useMemo(() => nodes.filter(n => n.type !== 'rack' && n.siteId === currentSiteId), [nodes, currentSiteId])
  const isHot = totalRoomBTU > 50000

  return (
    <>
      <color attach="background" args={isHot ? ['#3a1a1a'] : ['#e8eef2']} />
      <ambientLight intensity={0.8} color={isHot ? '#ff8c00' : '#ffffff'} />
      <directionalLight position={[10, 10, 5]} intensity={1} color={isHot ? '#ffb347' : '#ffffff'} />
      
      <Grid 
        args={[30, 30]} 
        cellSize={1} 
        cellThickness={1} 
        cellColor="#b9c5cf" 
        sectionSize={5} 
        sectionThickness={1.5} 
        sectionColor="#48afbb" 
        fadeDistance={25} 
        fadeStrength={1.5} 
      />

      <OrbitControls 
        makeDefault 
        enableDamping={true} 
        dampingFactor={0.05} 
        rotateSpeed={0.5} 
        zoomSpeed={0.7} 
        minDistance={5} 
        maxDistance={50} 
      />
      
      <CameraAnimator />

      <Floor />
      <WanGatewayPanel />
      <CloudGateway />
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