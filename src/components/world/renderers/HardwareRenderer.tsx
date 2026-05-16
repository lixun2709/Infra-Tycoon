import { useMemo, useRef } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import type { InfraNode } from '../../../store/infraTypes'
import { APPLICATION_CATALOG } from '../../../physics/applicationLibrary'
import { CoolingFan } from '../CoolingFan'

// --- Sub-components extracted from Scene.tsx ---

export function StorageBar({ used, total, color, h }: { used: number, total: number, color: string, h: number }) {
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

export function PIIShield({ h }: { h: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y = clock.getElapsedTime() * 2
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

export function MaintenanceIcon() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.rotation.z = clock.getElapsedTime() * 4
    meshRef.current.position.y = Math.sin(clock.getElapsedTime() * 10) * 0.05
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

export function PortVisuals({ node, h, onSelect }: { node: InfraNode, h: number, onSelect: (id: string) => void }) {
  const { handlePortClick, activePatchSource } = useInfraStore()
  
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

          return (
            <group key={port.id} position={[x, y, 0]}>
              <mesh 
                onClick={(e) => { e.stopPropagation(); handlePortClick(node.id, port.id); }}
                position={[0, 0, 0.001]}
              >
                <boxGeometry args={[portSize, portSize, 0.004]} />
                <meshStandardMaterial 
                  color={isPlugged ? "#00f2ff" : "#f59e0b"} 
                  metalness={1} roughness={0.1} 
                  emissive={isPlugged ? "#00f2ff" : "#f59e0b"}
                  emissiveIntensity={isPlugged ? 5.0 : 0.8}
                />
              </mesh>
              
              <Text position={[0, portSize * 0.6 + 0.003, 0.005]} fontSize={isHighDensity ? 0.0035 : 0.006} color="#94a3b8" anchorX="center" anchorY="bottom">
                {port.label}
              </Text>
            </group>
          )
        })}
      </group>
    </group>
  )
}

export function InternalHardware({ node, h }: { node: InfraNode, h: number }) {
  const health = node.componentHealth || { 
    cpu: ['healthy'], 
    ram: ['healthy', 'healthy', 'healthy', 'healthy'], 
    drives: ['healthy', 'healthy'] 
  }
  
  return (
    <group position={[0, -0.02, 0.05]}>
      {/* Dual CPU Heatsinks */}
      {health.cpu.map((status: string, i: number) => (
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
          <Billboard position={[0, h * 0.425 + 0.02, 0]}>
            <Text fontSize={0.04} color="#ffffff" anchorY="middle" outlineColor="#000000" outlineWidth={0.005}>
              CPU {i} {status !== 'healthy' && `(${status.toUpperCase()})`}
            </Text>
          </Billboard>
        </group>
      ))}
      
      {/* RAM Banks */}
      <group position={[0, 0, 0.2]}>
        {health.ram.map((status: string, i: number) => (
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
        {health.drives.slice(0, 6).map((status: string, i: number) => (
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
            <Billboard position={[0, h * 0.475 + 0.02, 0]}>
              <Text fontSize={0.02} color="#ffffff" anchorY="middle" outlineColor="#000000" outlineWidth={0.005}>
                DRIVE {i}
              </Text>
            </Billboard>
          </group>
        ))}
      </group>

      {/* Cooling Fans */}
      <group position={[0, 0, 0.35]}>
        <CoolingFan position={[-0.3, 0, 0]} nodeId={node.id} currentPowerKW={node.currentPowerKW || 0} maxPowerKW={node.maxPowerKW || 5} h={h} />
        <CoolingFan position={[0.3, 0, 0]} nodeId={node.id} currentPowerKW={node.currentPowerKW || 0} maxPowerKW={node.maxPowerKW || 5} h={h} />
      </group>
    </group>
  )
}

export function ServiceHolograms({ node }: { node: InfraNode }) {
  const allApplications = useInfraStore(s => s.applications)
  const applications = useMemo(() => allApplications.filter(a => a.nodeId === node.id), [allApplications, node.id])
  
  if (applications.length === 0) return null

  return (
    <Billboard position={[0.65, 0, 0.45]}>
      {applications.map((app, i) => {
        const appInfo = APPLICATION_CATALOG[app.appId]
        if (!appInfo) return null

        return (
          <group key={app.id} position={[0, (i - (applications.length - 1) / 2) * 0.12, 0]}>
            <Text 
              fontSize={0.08} 
              color={app.status === 'deploying' ? '#94a3b8' : appInfo.color} 
              outlineColor="#000000" 
              outlineWidth={0.005}
            >
              {appInfo.icon}
            </Text>
            <pointLight color={appInfo.color} distance={0.3} intensity={app.status === 'running' ? 0.8 : 0.2} />
          </group>
        )
      })}
    </Billboard>
  )
}
