import { Edges, Line, OrbitControls, Text, Grid, Float, Billboard } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import type { InfraNode } from '../../store/useInfraStore'
import { useInfraStore } from '../../store/useInfraStore'
import { Assistant } from './Assistant'
import { HeatMapOverlay } from './HeatMapOverlay'
import { CableSystem } from './CableSystem'

export const RACK_HEIGHT = 2.1
const RACK_U = 42
export const U_WORLD = RACK_HEIGHT / RACK_U

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

function StorageBar({ used, total, color, h }: { used: number, total: number, color: string, h: number }) {
  const ratio = total > 0 ? Math.min(1, used / total) : 0
  const barH = h * ratio
  if (barH <= 0) return null
  return (
    <group position={[-0.45, 0, 0.445]}>
      <mesh>
        <boxGeometry args={[0.03, h, 0.01]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, -h / 2 + barH / 2, 0.005]}>
        <boxGeometry args={[0.03, barH, 0.01]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}


function PIIShield({ h }: { h: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y = clock.elapsedTime * 2
  })
  return (
    <group position={[0, -h / 2 + 0.05, 0]}>
      <mesh ref={meshRef}>
        <torusGeometry args={[0.55, 0.015, 16, 32]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} />
      </mesh>
      <pointLight color="#fbbf24" distance={0.5} intensity={1} />
    </group>
  )
}

function MaintenanceIcon() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.z = clock.elapsedTime * 4
    meshRef.current.position.y = Math.sin(clock.elapsedTime * 10) * 0.05
  })
  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.05, 12, 8]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={2} />
      </mesh>
      <pointLight color="#2dd4bf" distance={1} intensity={2} />
    </group>
  )
}


function PortVisuals({ node, h, onSelect }: { node: InfraNode, h: number, onSelect: (id: string) => void }) {
  const { handlePortClick, activePatchSource } = useInfraStore()
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null)
  const isSelected = useInfraStore(s => s.selectedNodeId === node.id)
  
  const scheme = useMemo(() => {
    switch(node.type) {
      case 'network': return { panel: '#0f172a', bezel: '#334155', boundary: '#1e293b' }
      case 'storage': return { panel: '#1e3a8a', bezel: '#1e40af', boundary: '#1d4ed8' }
      case 'compute': return { panel: '#171717', bezel: '#404040', boundary: '#262626' }
      case 'security': return { panel: '#450a0a', bezel: '#7f1d1d', boundary: '#991b1b' }
      default: return { panel: '#1a1a1a', bezel: '#262626', boundary: '#404040' }
    }
  }, [node.type])

  const sortedPorts = useMemo(() => [...node.ports].sort((a, b) => {
    if (a.type === 'power' && b.type !== 'power') return -1
    if (a.type !== 'power' && b.type === 'power') return 1
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  }), [node.ports])

  return (
    <group position={[0, 0, -0.455]} rotation={[0, Math.PI, 0]}>
      {/* Bezel Frame */}
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.91, h * 0.92, 0.01]} />
        <meshStandardMaterial color={scheme.bezel} metalness={1} roughness={0.1} />
      </mesh>

      {/* Main Recessed Back Panel */}
      <mesh position={[0, 0, 0.004]} onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.88, h * 0.88, 0.002]} />
        <meshStandardMaterial color={scheme.panel} metalness={0.5} roughness={0.8} />
      </mesh>

      <group position={[0, 0, 0.01]}>
        {sortedPorts.map((port, idx) => {
          const portCount = sortedPorts.length
          const isHighDensity = portCount > 12
          
          let portsPerRow = 8
          if (isHighDensity) {
            if (portCount <= 24) portsPerRow = 12
            else if (portCount <= 54) portsPerRow = Math.ceil(portCount / 2)
            else portsPerRow = 24
          }
          
          const rowCount = Math.ceil(portCount / portsPerRow)
          const row = Math.floor(idx / portsPerRow)
          const col = idx % portsPerRow
          
          const portsInThisRow = (row === rowCount - 1) ? (portCount % portsPerRow || portsPerRow) : portsPerRow
          
          const totalWidth = 0.88
          const spacingX = isHighDensity ? (totalWidth / (portsPerRow - 1)) * 0.95 : (portsInThisRow > 1 ? totalWidth / (portsInThisRow - 1) * 0.9 : 0.1)
          const spacingY = isHighDensity ? 0.025 : 0.045
          const portSize = isHighDensity ? 0.009 : 0.014
          
          const x = portsInThisRow > 1 ? (col - (portsInThisRow - 1) / 2) * spacingX : 0
          const y = (rowCount > 1) ? (row - (rowCount - 1) / 2) * -spacingY : 0

          const isSource = activePatchSource?.nodeId === node.id && activePatchSource?.portId === port.id
          const isPlugged = port.connectedTo !== null || isSource

          // Containment Boundaries (Only show if selected)
          const showBoundary = isSelected && (idx % (isHighDensity ? 12 : 4) === 0)
          const boundaryWidth = isHighDensity ? spacingX * 11.5 : spacingX * 3.5

          return (
            <group key={port.id} position={[x, y, 0]}>
              {showBoundary && (
                <mesh position={[boundaryWidth / 2 - spacingX * 0.2, 0, -0.002]}>
                  <planeGeometry args={[boundaryWidth + spacingX * 0.8, spacingY * 1.2]} />
                  <meshStandardMaterial color={scheme.boundary} transparent opacity={0.3} />
                </mesh>
              )}

              {/* Port Outer Housing - Only 1 mesh instead of 2 for optimization */}
              <mesh position={[0, 0, -0.003]}>
                <boxGeometry args={[portSize * 1.2, portSize * 1.2, 0.006]} />
                <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
              </mesh>

              {/* Port Inner Core */}
              <mesh 
                onPointerOver={() => setHoveredPortId(port.id)}
                onPointerOut={() => setHoveredPortId(null)}
                onClick={(e) => { e.stopPropagation(); handlePortClick(node.id, port.id); }}
                position={[0, 0, 0.001]}
              >
                <boxGeometry args={[portSize, portSize, 0.004]} />
                <meshStandardMaterial 
                  color={isPlugged ? "#00f2ff" : "#ffffff"} 
                  metalness={1} roughness={0.0} 
                  emissive={isPlugged ? "#00f2ff" : "#ffffff"}
                  emissiveIntensity={isPlugged ? 4.0 : 1.5}
                />
              </mesh>
              
              <Text position={[0, portSize * 0.6 + 0.003, 0.005]} fontSize={isHighDensity ? 0.0035 : 0.006} color="#94a3b8" anchorX="center" anchorY="bottom">
                {port.label}
              </Text>

              {/* Only show details if selected or hovered */}
              {(isSelected || hoveredPortId === port.id) && (
                <>
                  {hoveredPortId === port.id && (
                    <Billboard position={[0, 0.04, 0.05]} follow={true}>
                      <mesh position={[0, 0, -0.01]}>
                        <planeGeometry args={[0.08, 0.02]} />
                        <meshBasicMaterial color="#000000" transparent opacity={0.8} />
                      </mesh>
                      <Text fontSize={0.012} color="#00f2ff">
                        {port.label.toUpperCase()}
                      </Text>
                    </Billboard>
                  )}
                </>
              )}

              <StatusLED portId={port.id} nodeId={node.id} />
            </group>
          )
        })}
      </group>
    </group>
  )
}

function StatusLED({ portId, nodeId }: { portId: string, nodeId: string }) {
  const { connections, nodes } = useInfraStore()
  const node = nodes.find(n => n.id === nodeId)
  const port = node?.ports.find(p => p.id === portId)
  const conn = connections.find(c => (c.startNodeId === nodeId && c.startPortId === portId) || (c.endNodeId === nodeId && c.endPortId === portId))
  
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  const otherNodeId = conn ? (conn.startNodeId === nodeId ? conn.endNodeId : conn.startNodeId) : null
  const otherNodeExists = nodes.some(n => n.id === otherNodeId)
  
  const isNegotiating = port?.status === 'negotiating'
  const isActive = conn && conn.status === 'active' && otherNodeExists && !isNegotiating
  const isBlocked = conn && conn.status === 'blocked' && otherNodeExists

  const isSelected = useInfraStore(s => s.selectedNodeId === nodeId)

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

function MountedUnit({ node, isSelected, onSelect }: { node: InfraNode, isSelected: boolean, onSelect: (id: string) => void }) {
  if (node.slotIndex == null || node.parentRackId == null) return null

  // Slide-and-Seat Animation Logic
  const updateNode = useInfraStore(s => s.updateNode)
  const finalRemoveNode = useInfraStore(s => s.finalRemoveNode)
  
  const isDecommissioning = node.provisioningState === 'decommissioning'
  // Only animate if the node is "racked" AND it was installed in the last 10 seconds
  const isBrandNew = node.provisioningState === 'racked' && (Date.now() - (node.installTimestamp || 0) < 10000)
  
  const [isSeated, setIsSeated] = useState(!isBrandNew && !isDecommissioning)
  const progress = useRef(isSeated ? 1 : 0)
  const zOffset = useRef(isSeated ? 0 : -1.2)

  // Watch for external decommissioning triggers (e.g. from Inspector)
  useEffect(() => {
    if (isDecommissioning) {
      setIsSeated(false)
      progress.current = 1 // Start from fully seated
    }
  }, [isDecommissioning])
  
  useFrame((_, delta) => {
    if (isDecommissioning) {
      // Reverse 4-Stage Animation (Un-mounting)
      progress.current -= delta * 0.15 
      const t = Math.max(0, progress.current)
      
      const stage = Math.floor(t * 4)
      const stageT = (t * 4) % 1
      
      let smoothedT = stage / 4
      if (stageT > 0.4) {
        smoothedT += ((stageT - 0.4) / 0.6) * (1 / 4)
      }
      
      zOffset.current = -1.2 * (1 - smoothedT)
      
      if (t <= 0) {
        finalRemoveNode(node.id)
      }
      return
    }

    if (!isSeated) {
      // 4-Stage Animation (Mounting)
      progress.current += delta * 0.125 
      const t = Math.min(1, progress.current)
      const stage = Math.floor(t * 4)
      const stageT = (t * 4) % 1
      
      let smoothedT = stage / 4
      if (stageT < 0.6) {
        smoothedT += (stageT / 0.6) * (1 / 4)
      } else {
        smoothedT += (1 / 4)
      }
      
      const ease = Math.min(1, smoothedT)
      zOffset.current = -1.2 * (1 - ease)

      if (t >= 1) {
        zOffset.current = 0
        setIsSeated(true)
        updateNode(node.id, { provisioningState: 'bootstrapped' })
      }
    }
  })

  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  const isAnyNodeSelected = !!selectedNodeId
  
  const color = (node.catalogKey != null && HARDWARE_CATALOG[node.catalogKey]) 
    ? HARDWARE_CATALOG[node.catalogKey].color 
    : TYPE_ACCENT[node.type] ?? '#718096'

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)
  const healthColor = node.isInfected ? '#d946ef' : node.healthStatus === 'critical' ? '#ef4444' : node.healthStatus === 'degraded' ? '#eab308' : '#22c55e'

  const emissiveColor = node.isInfected ? '#d946ef' : (node.healthStatus === 'critical' ? '#ef4444' : (node.degradation > 70 ? '#f59e0b' : '#000000'))
  const emissiveIntensity = (node.healthStatus === 'critical' || node.isInfected) ? (Math.sin(Date.now() / 150) * 0.8 + 1.2) : (node.degradation > 70 ? (Math.random() * 0.4 + 0.2) : (isSelected ? 1.5 : 1))

  // Smart transparency: make neighbors ghosted if something is selected
  const opacity = isSelected ? 0.15 : (isAnyNodeSelected ? 0.4 : 1.0)

  return (
    <group position={[0, y, zOffset.current]}>
      {node.isRefreshing ? (
        <MaintenanceIcon />
      ) : (
        <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
          <boxGeometry args={[0.92, h, 0.9]} />
          <meshStandardMaterial
            color={node.isInfected ? '#4a044e' : color}
            metalness={0.4}
            roughness={0.4}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            transparent={opacity < 1}
            opacity={opacity}
          />
          <Edges color={isSelected ? '#00f2ff' : '#f7fafc'} threshold={20} lineWidth={isSelected ? 3 : 1} />
        </mesh>
      )}

      {isSelected && <InternalHardware node={node} h={h} />}

      {(node.totalStorageTB ?? 0) > 0 && <StorageBar used={node.usedStorageTB ?? 0} total={node.totalStorageTB ?? 0} color="#2dd4bf" h={h} />}
      {node.dataCategory === 'PII' && <PIIShield h={h} />}
      
      {/* Horizontal Cable Management Arm (CMA) */}
      <PortVisuals node={node} h={h} onSelect={onSelect} />

      <mesh position={[0.4, 0, 0.445]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial color={healthColor} emissive={healthColor} emissiveIntensity={1.5} />
      </mesh>

      {node.isImmutable && (
        <group position={[0, h / 2 + 0.04, 0.45]}>
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

      {/* Chaos Spark Particles */}
      {node.healthStatus === 'degraded' && <ChaosSparkParticles h={h} />}

      {/* Migration indicator */}
      {node.activeMigration && (
        <group position={[0, h / 2 + 0.08, 0.45]}>
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

function InternalHardware({ node, h }: { node: InfraNode, h: number }) {
  const health = node.componentHealth || { cpu: ['healthy'], ram: ['healthy', 'healthy', 'healthy', 'healthy'], drives: ['healthy', 'healthy'] }
  
  return (
    <group position={[0, -0.02, 0.05]}>
      {/* Dual CPU Heatsinks */}
      {health.cpu.map((status, i) => (
        <group key={`cpu-${i}`} position={[i === 0 ? -0.15 : 0.15, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.22, h * 0.85, 0.22]} />
            <meshStandardMaterial 
              color={status === 'healthy' ? '#ffffff' : status === 'degraded' ? '#eab308' : '#ef4444'} 
              metalness={0.5} roughness={0.1} 
              emissive={status === 'healthy' ? '#ffffff' : status === 'degraded' ? '#eab308' : '#ef4444'} 
              emissiveIntensity={status === 'healthy' ? 0.2 : 0.8} 
            />
          </mesh>
          <Billboard position={[0, h * 0.425 + 0.02, 0]} follow={true}>
            <Text fontSize={0.04} color="#ffffff" anchorY="middle" outlineColor="#000000" outlineWidth={0.005}>
              CPU {i} {status !== 'healthy' && `(${status.toUpperCase()})`}
            </Text>
          </Billboard>
        </group>
      ))}
      
      {/* RAM Banks */}
      <group position={[0, 0, 0.2]}>
        {health.ram.map((status, i) => (
          <group key={`ram-${i}`} position={[i * 0.04 - (health.ram.length * 0.02), 0, 0]}>
            <mesh>
              <boxGeometry args={[0.015, h * 0.75, 0.18]} />
              <meshStandardMaterial 
                color={status === 'healthy' ? '#ffffff' : status === 'degraded' ? '#eab308' : '#ef4444'} 
                roughness={0.5} 
                emissive={status === 'healthy' ? '#ffffff' : status === 'degraded' ? '#eab308' : '#ef4444'} 
                emissiveIntensity={status === 'healthy' ? 0.1 : 0.6} 
              />
            </mesh>
          </group>
        ))}
      </group>
      
      {/* HDD/SSD Drive Array */}
      <group position={[0, 0, -0.3]}>
        {health.drives.slice(0, 6).map((status, i) => (
          <group key={`drive-${i}`} position={[i * 0.12 - 0.3, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.11, h * 0.95, 0.28]} />
              <meshStandardMaterial 
                color={status === 'healthy' ? '#ffffff' : status === 'degraded' ? '#eab308' : '#ef4444'} 
                metalness={0.3} roughness={0.2} 
                emissive={status === 'healthy' ? '#ffffff' : status === 'degraded' ? '#eab308' : '#ef4444'} 
                emissiveIntensity={status === 'healthy' ? 0.05 : 0.5} 
              />
            </mesh>
            <Billboard position={[0, h * 0.475 + 0.02, 0]} follow={true}>
              <Text fontSize={0.02} color="#ffffff" anchorY="middle" outlineColor="#000000" outlineWidth={0.005}>
                DRIVE {i}
              </Text>
            </Billboard>
          </group>
        ))}
      </group>

    </group>
  )
}

function ChaosSparkParticles({ h }: { h: number }) {
  const sparkCount = 8
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const offsets = useMemo(() =>
    Array.from({ length: sparkCount }, () => ({
      x: (Math.random() - 0.5) * 0.8,
      y: (Math.random() - 0.5) * h,
      z: (Math.random() - 0.5) * 0.8,
      speed: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    })), [h])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime
    offsets.forEach((o, i) => {
      const flicker = Math.sin(t * o.speed * 10 + o.phase) * 0.5 + 0.5
      dummy.position.set(o.x, o.y + Math.sin(t * o.speed + o.phase) * 0.15, o.z)
      dummy.scale.setScalar(flicker * 0.03 + 0.01)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, sparkCount]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
    </instancedMesh>
  )
}

function ChaosOverlay() {
  const isChaosMode = useInfraStore(s => s.isChaosMode)
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!meshRef.current || !isChaosMode) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.02 + Math.sin(clock.elapsedTime * 8) * 0.015 + Math.random() * 0.01
  })

  if (!isChaosMode) return null

  return (
    <mesh ref={meshRef} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshBasicMaterial color="#ff0000" transparent opacity={0.03} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
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
      <mesh>
        <boxGeometry args={[1, RACK_HEIGHT, 1]} />
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

function Floor() {
  const { placementMode, setPlacementMode, addNode, currentSiteId } = useInfraStore()
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
            catalogKey: 'RACK_42U',
            ports: [],
            siteId: currentSiteId,
            services: [],
            systemState: 'running',
            bootProgress: 100,
            provisioningState: 'bootstrapped',
            installDate: useInfraStore.getState().simulationCycle,
            degradation: 0,
            temperature: 22
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

const CLOUD_GATEWAY_POS = new THREE.Vector3(18, 3, 0)

function CloudParticle({ offset }: { offset: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() + offset
    ref.current.position.y = Math.sin(t * 0.8) * 0.3
    ref.current.position.x = Math.cos(t * 0.5 + offset) * 0.4
    ref.current.position.z = Math.sin(t * 0.6 + offset * 2) * 0.4
      ; (ref.current.material as any).opacity = 0.4 + Math.sin(t * 1.5) * 0.3
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
  const { controls, camera } = useThree()
  const { selectedNodeId, nodes, currentSiteId, isGlobalMapOpen } = useInfraStore()
  const [isManualOverride, setIsManualOverride] = useState(false)
  const prevSiteId = useRef(currentSiteId)
  const prevMapState = useRef(isGlobalMapOpen)
  const prevSelectedId = useRef(selectedNodeId)

  useEffect(() => {
    // Reset override whenever selection changes OR when user clicks a node (even if same)
    setIsManualOverride(false)
    prevSelectedId.current = selectedNodeId
  }, [selectedNodeId, currentSiteId])

  useEffect(() => {
    if (!controls) return
    const handleStart = () => setIsManualOverride(true)
    ;(controls as any).addEventListener('start', handleStart)
    return () => (controls as any).removeEventListener('start', handleStart)
  }, [controls])

  useFrame((_, delta) => {
    if (!controls) return

    // Site switch transition: snap to site default view
    if (prevSiteId.current !== currentSiteId) {
      camera.position.lerp(new THREE.Vector3(5, 4, 5), 0.1)
      ;(controls as any).target.lerp(new THREE.Vector3(0, 0, 0), 0.1)
      if (camera.position.distanceTo(new THREE.Vector3(5, 4, 5)) < 0.1) {
        prevSiteId.current = currentSiteId
      }
      return
    }

    if (prevMapState.current !== isGlobalMapOpen) {
      // Zoom out when map opens
      if (isGlobalMapOpen) {
        camera.position.lerp(new THREE.Vector3(15, 12, 15), 0.05)
      } else {
        camera.position.lerp(new THREE.Vector3(5, 4, 5), 0.05)
      }
      if (camera.position.distanceTo(isGlobalMapOpen ? new THREE.Vector3(15, 12, 15) : new THREE.Vector3(5, 4, 5)) < 0.2) {
        prevMapState.current = isGlobalMapOpen
      }
    }

    if (!selectedNodeId || isManualOverride) return

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

    (controls as any).target.lerp(targetPos, delta * 12)
    ;(controls as any).update()
  })

  return null
}

function World() {
  const { nodes, selectedNodeId, setSelectedNode, totalRoomBTU, currentSiteId } = useInfraStore()
  const racks = useMemo(() => nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId), [nodes, currentSiteId])
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
        zoomSpeed={1.5}
        minDistance={0.5}
        maxDistance={100}
        enablePan={true}
        screenSpacePanning={true}
      />

      <CameraAnimator />

      <Floor />
      <ChaosOverlay />
      <CloudGateway />
      <BlueprintPreview />
      <CableSystem />
      <Assistant />
      <HeatMapOverlay />

      <DeployWave />

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

function BlueprintPreview() {
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

function DeployWave() {
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

export function Scene() {
  return (
    <Canvas className="h-full w-full" camera={{ position: [5, 4, 5], fov: 45 }} onPointerMissed={() => useInfraStore.getState().setSelectedNode(null)}>
      <World />
    </Canvas>
  )
}