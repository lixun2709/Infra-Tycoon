/* eslint-disable react-hooks/immutability */
import { useRef, useMemo, useState, useEffect } from 'react'
import { THEMES, type ThemeSpec } from '../../store/themeTypes'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useInfraStore } from '../../store/useInfraStore'
import type { InfraNode, Connection } from '../../store/infraTypes'
import { RACK_HEIGHT, U_WORLD } from '../../physics/dimensions'

// Custom high-fidelity cable shader with type-specific physical wave and pulse behaviors.
const CableShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#3b82f6') },
    uStatus: { value: 1.0 }, // 0: idle, 1: active, 2: error
    uHighlight: { value: 0.0 }, // 0: normal, 1: diagnostic highlight
    uType: { value: 0.0 }, // 0.0: network, 1.0: power, 2.0: fc, 3.0: sas
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
    uniform float uType;
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
      vec3 sheathColor = mix(uColor, vec3(1.0), 0.25);
      float alpha = 0.3; 

      vec3 color = sheathColor;
      
      if (uStatus > 0.5) {
        float pulse = 0.0;
        
        if (abs(uType - 1.0) < 0.1) {
          // Power: Smooth flowing wave representation of power/current
          float flow = sin(vProgress * 8.0 - uTime * 2.5);
          pulse = smoothstep(0.2, 0.8, flow) * 0.4;
          
          if (uStatus > 1.5) {
            // Overloaded / Error Power: Aggressive fluctuating red
            color = mix(sheathColor, vec3(1.0, 0.1, 0.1), pulse * 1.5);
            alpha = mix(alpha, 0.9, pulse);
          } else {
            // Power Flow: Warm glowing flow
            vec3 flowColor = mix(uColor, vec3(1.0, 0.9, 0.5), 0.5);
            color = mix(sheathColor, flowColor, pulse);
            alpha = mix(alpha, 0.8, pulse);
          }
        } else if (abs(uType - 2.0) < 0.1) {
          // Fiber (FC): Blazing fast photon packets
          float speed = 12.0;
          pulse = pow(max(0.0, sin(vProgress * 35.0 - uTime * speed)), 30.0);
          
          if (uStatus > 1.5) {
            color = mix(sheathColor, vec3(1.0, 0.0, 0.0), pulse);
            alpha = mix(alpha, 1.0, pulse);
          } else {
            // Cyan/white bright photon laser pulse
            vec3 laserColor = vec3(1.8, 2.5, 2.5);
            color = mix(sheathColor, laserColor, pulse);
            alpha = mix(alpha, 1.0, pulse);
          }
        } else {
          // Network & SAS: Regular packets
          float speed = 4.0;
          pulse = pow(max(0.0, sin(vProgress * 15.0 - uTime * speed)), 20.0);
          
          if (uStatus > 1.5) {
            color = mix(sheathColor, vec3(1.0, 0.0, 0.0), pulse);
            alpha = mix(alpha, 1.0, pulse);
          } else {
            vec3 pulseColor = vec3(1.5, 1.5, 1.5);
            color = mix(sheathColor, pulseColor, pulse);
            alpha = mix(alpha, 1.0, pulse);
          }
        }
      }

      // Rim lighting for the tube shape
      float rim = 1.0 - abs(vUv.y - 0.5) * 2.0;
      color += vec3(0.25) * pow(rim, 2.0);

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
  
  const totalWidth = 0.68 // Centered horizontally to match PortVisuals centered layout
  const spacingX = isHighDensity ? (totalWidth / (portsPerRow - 1)) * 0.95 : (portsInThisRow > 1 ? totalWidth / (portsInThisRow - 1) * 0.9 : 0.1)
  const spacingY = isHighDensity ? 0.025 : 0.045
  
  const x = portsInThisRow > 1 ? (col - (portsInThisRow - 1) / 2) * spacingX : 0
  const y = (rowCount > 1) ? (row - (rowCount - 1) / 2) * -spacingY : 0
  const z = -0.455

  // Since the back panel is rotated 180 degrees (PI), the local X is inverted relative to world X
  return new THREE.Vector3(rack.position.x - x, worldY + y, rack.position.z + z)
}

function CableConnector({ 
  position, 
  type, 
  themeSpec 
}: { 
  position: THREE.Vector3
  type: Connection['type']
  themeSpec: ThemeSpec 
}) {
  const materials = useMemo(() => {
    return {
      powerBody: new THREE.MeshStandardMaterial({
        color: '#111111', // Matte black
        roughness: 0.8,
        metalness: 0.1
      }),
      powerBoot: new THREE.MeshStandardMaterial({
        color: '#2a2a2a', // Dark grey rubber collar
        roughness: 0.8,
        metalness: 0.1
      }),
      networkBoot: new THREE.MeshStandardMaterial({
        color: themeSpec.render.cableNetwork || '#06b6d4',
        roughness: 0.5,
        metalness: 0.2
      }),
      networkClip: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.6,
        roughness: 0.2,
        metalness: 0.1
      }),
      fcBody: new THREE.MeshStandardMaterial({
        color: '#eab308', // Gold/beige standard LC casing
        roughness: 0.6,
        metalness: 0.1
      }),
      fcClamp: new THREE.MeshStandardMaterial({
        color: '#10b981', // Emerald green clip clamp
        roughness: 0.5,
        metalness: 0.1
      }),
      sasBody: new THREE.MeshStandardMaterial({
        color: '#a1a1aa', // Silver metallic casing
        roughness: 0.2,
        metalness: 0.8
      }),
      sasTab: new THREE.MeshStandardMaterial({
        color: '#3b82f6', // Bright blue release tab
        roughness: 0.7,
        metalness: 0.1
      })
    }
  }, [themeSpec])

  if (type === 'power') {
    return (
      <group position={position}>
        {/* Main C13 Plug Body */}
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[0.015, 0.015, 0.02]} />
          <primitive object={materials.powerBody} attach="material" />
        </mesh>
        {/* Rubber Collar Boot */}
        <mesh position={[0, 0, -0.008]}>
          <boxGeometry args={[0.011, 0.011, 0.012]} />
          <primitive object={materials.powerBoot} attach="material" />
        </mesh>
      </group>
    )
  }

  if (type === 'network') {
    return (
      <group position={position}>
        {/* RJ45 Boot */}
        <mesh position={[0, 0, -0.004]}>
          <boxGeometry args={[0.011, 0.011, 0.016]} />
          <primitive object={materials.networkBoot} attach="material" />
        </mesh>
        {/* Clear Plastic Plug Tip */}
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[0.008, 0.008, 0.01]} />
          <primitive object={materials.networkClip} attach="material" />
        </mesh>
        {/* Locking Clip Tab */}
        <mesh position={[0, 0.005, 0.006]}>
          <boxGeometry args={[0.002, 0.004, 0.008]} />
          <primitive object={materials.networkClip} attach="material" />
        </mesh>
      </group>
    )
  }

  if (type === 'fc') {
    return (
      <group position={position}>
        {/* Dual LC Fiber Ferrules (Twin cylinders side by side) */}
        <mesh position={[-0.004, 0, 0.004]}>
          <boxGeometry args={[0.004, 0.004, 0.016]} />
          <primitive object={materials.fcBody} attach="material" />
        </mesh>
        <mesh position={[0.004, 0, 0.004]}>
          <boxGeometry args={[0.004, 0.004, 0.016]} />
          <primitive object={materials.fcBody} attach="material" />
        </mesh>
        {/* Connector Base Clamp */}
        <mesh position={[0, 0, -0.006]}>
          <boxGeometry args={[0.012, 0.005, 0.008]} />
          <primitive object={materials.fcClamp} attach="material" />
        </mesh>
      </group>
    )
  }

  if (type === 'sas') {
    return (
      <group position={position}>
        {/* Heavy Silver Metallic SFF-8644 Plug */}
        <mesh position={[0, 0, 0.004]}>
          <boxGeometry args={[0.02, 0.008, 0.022]} />
          <primitive object={materials.sasBody} attach="material" />
        </mesh>
        {/* Pull tab ribbon */}
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[0.006, 0.001, 0.012]} />
          <primitive object={materials.sasTab} attach="material" />
        </mesh>
      </group>
    )
  }

  // Fallback box
  return (
    <mesh position={position}>
      <boxGeometry args={[0.01, 0.01, 0.03]} />
      <primitive object={materials.networkBoot} attach="material" />
    </mesh>
  )
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

  // Dynamic cable type resolution, falling back to port definition if missing
  const resolvedType = useMemo(() => {
    if (connection.type) return connection.type
    const sNode = allNodes.find(n => n.id === connection.startNodeId)
    const sPort = sNode?.ports.find(p => p.id === connection.startPortId)
    return sPort?.type || 'network'
  }, [connection.type, connection.startNodeId, connection.startPortId, allNodes])

  const activeTheme = useInfraStore(s => s.activeTheme)
  const themeSpec = THEMES[activeTheme]

  // Dynamic cable radius depending on high-fidelity physical type representation
  const cableRadius = useMemo(() => {
    if (resolvedType === 'power') return 0.005
    if (resolvedType === 'fc') return 0.0016
    if (resolvedType === 'sas') return 0.0045
    return 0.003 // Default network Ethernet Cat6
  }, [resolvedType])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      ...CableShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#ffffff') },
        uStatus: { value: connection.status === 'active' ? 1.0 : (connection.status === 'blocked' ? 2.0 : 0.0) },
        uHighlight: { value: 0.0 },
        uType: { value: resolvedType === 'network' ? 0.0 : (resolvedType === 'power' ? 1.0 : (resolvedType === 'fc' ? 2.0 : 3.0)) }
      },
      transparent: true,
    })
  }, [connection.status, resolvedType])

  useEffect(() => {
    let colorHex = '#ffffff'
    if (resolvedType === 'network') colorHex = themeSpec.render.cableNetwork
    else if (resolvedType === 'power') colorHex = themeSpec.render.cablePower
    else if (resolvedType === 'fc') colorHex = themeSpec.render.cableFC
    else if (resolvedType === 'sas') colorHex = themeSpec.render.cableSAS

    if (material.uniforms && material.uniforms.uColor && material.uniforms.uStatus && material.uniforms.uType) {
      material.uniforms.uColor.value.set(colorHex)
      material.uniforms.uStatus.value = connection.status === 'active' ? 1.0 : (connection.status === 'blocked' ? 2.0 : 0.0)
      material.uniforms.uType.value = resolvedType === 'network' ? 0.0 : (resolvedType === 'power' ? 1.0 : (resolvedType === 'fc' ? 2.0 : 3.0))
    }
  }, [material, resolvedType, connection.status, themeSpec])

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
        <tubeGeometry args={[curve, 20, cableRadius, 8, false]} />
        <primitive object={material} attach="material" />
      </mesh>
      
      {/* Start Connector */}
      <CableConnector position={startPos} type={resolvedType} themeSpec={themeSpec} />

      {/* End Connector */}
      <CableConnector position={endPos} type={resolvedType} themeSpec={themeSpec} />
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
