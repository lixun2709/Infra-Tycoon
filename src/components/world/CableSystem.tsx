import { useRef, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useInfraStore } from '../../store/useInfraStore'
import type { InfraNode, Connection } from '../../store/infraTypes'
import type { PortType } from '../../physics/hardwareLibrary'
import { RACK_HEIGHT, U_WORLD } from '../../physics/dimensions'

const CABLE_COLORS: Record<PortType, string> = {
  network: '#00f2ff', // Vibrant Cyan (Fiber optic look)
  power: '#facc15',   // Industrial Yellow
  fc: '#f97316',      // Alert Orange
  sas: '#d946ef',     // Magenta
}

const CABLE_RADIUS = 0.003

const CableShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#3b82f6') },
    uStatus: { value: 1.0 }, // 0: idle, 1: active, 2: error
    uHighlight: { value: 0.0 }, // 0: normal, 1: diagnostic highlight
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vProgress;
    
    void main() {
      vUv = uv;
      vProgress = uv.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uStatus;
    uniform float uHighlight;
    varying vec2 vUv;
    varying float vProgress;

    void main() {
      // Diagnostic highlight takes precedence
      if (uHighlight > 0.5) {
        vec3 highlightColor = vec3(1.5, 1.5, 2.0); // Intense white-blue glow
        gl_FragColor = vec4(highlightColor, 1.0);
        return;
      }

      // Outer sheath: semi-transparent, lightened version of the color
      vec3 sheathColor = mix(uColor, vec3(1.0), 0.2);
      float alpha = 0.25; 

      // Data flow / Inner layer
      vec3 color = sheathColor;
      
      if (uStatus > 0.5) {
        float speed = 4.0;
        // Sharper, brighter pulses
        float pulse = pow(max(0.0, sin(vProgress * 15.0 - uTime * speed)), 20.0);
        
        if (uStatus > 1.5) {
          // Error state: Red pulses
          color = mix(sheathColor, vec3(1.0, 0.0, 0.0), pulse);
          alpha = mix(alpha, 1.0, pulse);
        } else {
          // Active state: Overdriven white pulses for bloom effect
          vec3 pulseColor = vec3(1.5, 1.5, 1.5);
          color = mix(sheathColor, pulseColor, pulse);
          alpha = mix(alpha, 1.0, pulse);
        }
      }

      // Rim lighting for the tube shape
      float rim = 1.0 - abs(vUv.y - 0.5) * 2.0;
      color += vec3(0.3) * pow(rim, 2.0);

      gl_FragColor = vec4(color, alpha);
    }
  `
}

function getPortWorldPosition(node: InfraNode, portId: string, allNodes: InfraNode[]): THREE.Vector3 {
  if (node.slotIndex == null || node.parentRackId == null) {
      return new THREE.Vector3(node.position.x, node.position.y, node.position.z)
  }

  const rack = allNodes.find(n => n.id === node.parentRackId)
  if (!rack) return new THREE.Vector3(node.position.x, node.position.y, node.position.z)

  const yOffset = -RACK_HEIGHT / 2 + U_WORLD * (node.slotIndex - 1 + node.uHeight / 2)
  const worldY = rack.position.y + RACK_HEIGHT / 2 + yOffset

  // Group and sort ports exactly like PortVisuals
  const sortedPorts = [...node.ports].sort((a, b) => {
    if (a.type === 'power' && b.type !== 'power') return -1
    if (a.type !== 'power' && b.type === 'power') return 1
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  })

  const portIdx = sortedPorts.findIndex(p => p.id === portId)
  if (portIdx === -1) return new THREE.Vector3(rack.position.x, worldY, rack.position.z - 0.455)

  // Adaptive Spacing Logic matches PortVisuals exactly
  const portCount = sortedPorts.length
  const isHighDensity = portCount > 12
  
  let portsPerRow = 8
  if (isHighDensity) {
    if (portCount <= 24) portsPerRow = 12
    else if (portCount <= 54) portsPerRow = Math.ceil(portCount / 2)
    else portsPerRow = 24
  }
  
  const rowCount = Math.ceil(portCount / portsPerRow)
  const row = Math.floor(portIdx / portsPerRow)
  const col = portIdx % portsPerRow
  
  const portsInThisRow = (row === rowCount - 1) ? (portCount % portsPerRow || portsPerRow) : portsPerRow
  
  const totalWidth = 0.88
  const spacingX = isHighDensity ? (totalWidth / (portsPerRow - 1)) * 0.95 : (portsInThisRow > 1 ? totalWidth / (portsInThisRow - 1) * 0.9 : 0.1)
  const spacingY = isHighDensity ? 0.025 : 0.045
  
  const x = portsInThisRow > 1 ? (col - (portsInThisRow - 1) / 2) * spacingX : 0
  const y = (rowCount > 1) ? (row - (rowCount - 1) / 2) * -spacingY : 0
  const z = -0.455

  // Since the back panel is rotated 180 degrees (PI), the local X is inverted relative to world X
  return new THREE.Vector3(rack.position.x - x, worldY + y, rack.position.z + z)
}

function Cable({ connection, allNodes }: { connection: Connection, allNodes: InfraNode[] }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  const startNode = allNodes.find(n => n.id === connection.startNodeId)
  const endNode = allNodes.find(n => n.id === connection.endNodeId)

  // Pure session start time for time-based logic in effects/frames
  const [sessionStartTime] = useState(() => Date.now())

  const { curve, startPos, endPos } = useMemo(() => {
    if (!startNode || !endNode) return { curve: null, startPos: null, endPos: null }
    const start = getPortWorldPosition(startNode, connection.startPortId, allNodes)
    const end = getPortWorldPosition(endNode, connection.endPortId, allNodes)

    const dist = start.distanceTo(end)
    const isSameRack = startNode.parentRackId === endNode.parentRackId

    let points: THREE.Vector3[] = []

    if (isSameRack) {
      // Professional Routing: Out -> Channel -> Channel -> In
      const rack = allNodes.find(n => n.id === startNode.parentRackId)!
      const sideX = start.x > rack.position.x ? rack.position.x + 0.46 : rack.position.x - 0.46
      
      const p1 = new THREE.Vector3(start.x, start.y, start.z - 0.05) // Out of port
      const p2 = new THREE.Vector3(sideX, p1.y, p1.z) // To side channel
      const p3 = new THREE.Vector3(sideX, end.y, end.z - 0.05) // Down/Up channel
      const p4 = new THREE.Vector3(end.x, end.y, end.z - 0.05) // Back from channel
      
      points = [start, p1, p2, p3, p4, end]
    } else {
      // Cross-rack routing: Loop through the top/bottom or just a deep loop
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
      mid.z -= Math.max(0.5, dist * 0.5) // Deep loop for cross-rack
      mid.y -= 0.2
      points = [start, mid, end]
    }

    return { 
      curve: new THREE.CatmullRomCurve3(points),
      startPos: start,
      endPos: end
    }
  }, [connection, startNode, endNode, allNodes])

  const material = useMemo(() => {
    const color = connection.type ? CABLE_COLORS[connection.type] : '#ffffff'
    return new THREE.ShaderMaterial({
      ...CableShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uStatus: { value: connection.status === 'active' ? 1.0 : (connection.status === 'blocked' ? 2.0 : 0.0) },
        uHighlight: { value: 0.0 }
      },
      transparent: true,
    })
  }, [connection.type, connection.status])

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.ShaderMaterial
      const uTime = mat.uniforms.uTime
      if (uTime) uTime.value = clock.elapsedTime
      
      const uHighlight = mat.uniforms.uHighlight
      if (uHighlight) {
        const now = sessionStartTime + clock.elapsedTime * 1000
        uHighlight.value = (connection.highlightTime && connection.highlightTime > now) ? 1.0 : 0.0
      }
    }
  })

  if (!curve || !startPos || !endPos) return null

  return (
    <group>
      <mesh ref={meshRef}>
        <tubeGeometry args={[curve, 20, CABLE_RADIUS, 8, false]} />
        <primitive object={material} attach="material" />
      </mesh>
      
      {/* Start Connector (Blue RJ45 Style) */}
      <mesh position={startPos} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.012, 0.012, 0.04]} />
        <meshStandardMaterial color="#2563eb" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* End Connector (Blue RJ45 Style) */}
      <mesh position={endPos} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.012, 0.012, 0.04]} />
        <meshStandardMaterial color="#2563eb" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

export function CableSystem() {
  const nodes = useInfraStore(s => s.nodes)
  const connections = useInfraStore(s => s.connections)
  const currentSiteId = useInfraStore(s => s.currentSiteId)

  const siteConnections = useMemo(() => {
    return connections.filter(conn => {
      const sNode = nodes.find(n => n.id === conn.startNodeId)
      return sNode?.siteId === currentSiteId
    })
  }, [connections, nodes, currentSiteId])

  return (
    <group>
      {siteConnections.map(conn => (
        <Cable key={conn.id} connection={conn} allNodes={nodes} />
      ))}
    </group>
  )
}
