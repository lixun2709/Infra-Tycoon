import { useMemo, useRef } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import type { InfraNode } from '../../../store/infraTypes'
import { APPLICATION_CATALOG } from '../../../physics/applicationLibrary'
import { CoolingFan } from '../CoolingFan'

// --- Global Cached Resources ---
const cpuGeometry = new THREE.BoxGeometry(0.22, 1, 0.22)
const ramGeometry = new THREE.BoxGeometry(0.015, 1, 0.18)
const driveGeometry = new THREE.BoxGeometry(0.11, 1, 0.28)
const portGeometry = new THREE.BoxGeometry(1, 1, 0.004)
const piiTorusGeometry = new THREE.TorusGeometry(0.55, 0.015, 16, 32)
const maintenanceTorusGeometry = new THREE.TorusGeometry(0.2, 0.05, 12, 8)
const bezelGeometry = new THREE.BoxGeometry(0.91, 1, 0.01)
const panelGeometry = new THREE.BoxGeometry(0.88, 1, 0.002)
const storageBgGeometry = new THREE.BoxGeometry(0.03, 1, 0.01)
const storageFgGeometry = new THREE.BoxGeometry(0.03, 1, 0.01)

const materials = {
  healthy: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.5, roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.2 }),
  healthyDrive: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.3, roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.05 }),
  healthyRam: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.1 }),
  degraded: new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.5, roughness: 0.1, emissive: '#eab308', emissiveIntensity: 0.8 }),
  critical: new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.5, roughness: 0.1, emissive: '#ef4444', emissiveIntensity: 0.8 }),
  pii: new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 1 }),
  maintenance: new THREE.MeshStandardMaterial({ color: '#2dd4bf', emissive: '#2dd4bf', emissiveIntensity: 2 }),
  storageBg: new THREE.MeshBasicMaterial({ color: '#0f172a' }),
  portConnected: new THREE.MeshStandardMaterial({ color: '#00f2ff', metalness: 1, roughness: 0.1, emissive: '#00f2ff', emissiveIntensity: 5.0 }),
  portDisconnected: new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 1, roughness: 0.1, emissive: '#f59e0b', emissiveIntensity: 0.8 })
}

// --- Sub-components extracted from Scene.tsx ---

export function StorageBar({ used, total, color, h }: { used: number, total: number, color: string, h: number }) {
  const ratio = total > 0 ? Math.min(1, used / total) : 0
  const barH = h * ratio
  if (barH <= 0) return null
  return (
    <group position={[-0.45, 0, 0.445]}>
      <mesh geometry={storageBgGeometry} material={materials.storageBg} scale={[1, h, 1]} />
      <mesh geometry={storageFgGeometry} position={[0, -h / 2 + barH / 2, 0.005]} scale={[1, barH, 1]}>
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
      <mesh ref={meshRef} geometry={piiTorusGeometry} material={materials.pii} />
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
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]} geometry={maintenanceTorusGeometry} material={materials.maintenance} />
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
      <mesh geometry={bezelGeometry} scale={[1, h * 0.92, 1]} onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <meshStandardMaterial color={scheme.bezel} metalness={1} roughness={0.1} />
      </mesh>

      {/* Main Recessed Back Panel */}
      <mesh geometry={panelGeometry} scale={[1, h * 0.88, 1]} position={[0, 0, 0.004]} onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
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
                geometry={portGeometry}
                scale={[portSize, portSize, 1]}
                material={isPlugged ? materials.portConnected : materials.portDisconnected}
              />
              
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
          <mesh 
            geometry={cpuGeometry} 
            scale={[1, h * 0.85, 1]} 
            material={status === 'healthy' ? materials.healthy : status === 'degraded' ? materials.degraded : materials.critical} 
          />
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
            <mesh 
              geometry={ramGeometry} 
              scale={[1, h * 0.75, 1]} 
              material={status === 'healthy' ? materials.healthyRam : status === 'degraded' ? materials.degraded : materials.critical}
            />
          </group>
        ))}
      </group>
      
      {/* HDD/SSD Drive Array */}
      <group position={[0, 0, -0.3]}>
        {health.drives.slice(0, 6).map((status: string, i: number) => (
          <group key={`drive-${i}`} position={[i * 0.12 - 0.3, 0, 0]}>
            <mesh 
              geometry={driveGeometry} 
              scale={[1, h * 0.95, 1]} 
              material={status === 'healthy' ? materials.healthyDrive : status === 'degraded' ? materials.degraded : materials.critical}
            />
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
