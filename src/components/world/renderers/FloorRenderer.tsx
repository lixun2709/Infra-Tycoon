import { useState, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Edges, Text } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { useInput } from '../../../contexts/InputContext'
import { RACK_HEIGHT } from '../../../physics/dimensions'
import { PREDEFINED_SLOTS, findNearestSlot } from '../../../physics/zoning'

interface HoloIndicatorProps {
  x: number
  z: number
  hx: number
  hz: number
  direction: 'N' | 'S' | 'E' | 'W'
  onExpand: (hx: number, hz: number, dir: 'N' | 'S' | 'E' | 'W') => void
}

// Floating holographic architectural indicators for expansion
function HoloIndicator({ x, z, hx, hz, direction, onExpand }: HoloIndicatorProps) {
  const [hovered, setHovered] = useState(false)
  const ringRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.position.y = 0.25 + Math.sin(state.clock.getElapsedTime() * 3.5) * 0.06
      ringRef.current.rotation.y = state.clock.getElapsedTime() * 0.7
    }
  })

  return (
    <group 
      position={[x, 0, z]} 
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onExpand(hx, hz, direction)
      }}
    >
      {/* Collidable Sphere for clicking */}
      <mesh visible={false}>
        <sphereGeometry args={[1.2, 16, 16]} />
      </mesh>

      <group ref={ringRef}>
        {/* Floating Ring */}
        <mesh>
          <torusGeometry args={[0.5, 0.03, 8, 24]} />
          <meshStandardMaterial 
            color={hovered ? '#22c55e' : '#f97316'} 
            emissive={hovered ? '#22c55e' : '#f97316'} 
            emissiveIntensity={hovered ? 4.0 : 2.0} 
            transparent
            opacity={0.9}
          />
        </mesh>
        
        {/* 3D Plus mesh inside */}
        <group>
          <mesh>
            <boxGeometry args={[0.06, 0.4, 0.06]} />
            <meshStandardMaterial 
              color={hovered ? '#22c55e' : '#f97316'} 
              emissive={hovered ? '#22c55e' : '#f97316'} 
              emissiveIntensity={hovered ? 3.0 : 1.5} 
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.06, 0.4, 0.06]} />
            <meshStandardMaterial 
              color={hovered ? '#22c55e' : '#f97316'} 
              emissive={hovered ? '#22c55e' : '#f97316'} 
              emissiveIntensity={hovered ? 3.0 : 1.5} 
            />
          </mesh>
        </group>
      </group>

      {/* Circular anchor ring on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.42, 0.5, 24]} />
        <meshBasicMaterial 
          color={hovered ? '#22c55e' : '#f97316'} 
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  )
}

export function FloorRenderer() {
  const { 
    placementMode, 
    nodes, 
    currentSiteId,
    facilityColumnsCount,
    halls,
    expandHallDirection
  } = useInfraStore(useShallow(state => ({
    placementMode: state.placementMode, 
    nodes: state.nodes, 
    currentSiteId: state.currentSiteId,
    facilityColumnsCount: state.facilityColumnsCount,
    halls: state.halls,
    expandHallDirection: state.expandHallDirection
  })))
  const { dispatchIntent } = useInput()
  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null)

  const ghostOccupied = ghostPos
    ? nodes.some(
        n =>
          n.type === 'rack' &&
          n.siteId === currentSiteId &&
          Math.round(n.position.x) === ghostPos.x &&
          Math.round(n.position.z) === ghostPos.z
      )
    : false

  // Shared Canvas Texture Generation for Epoxy Raised Floor
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const w = 30
    const l = 30

    // 1. Base Epoxy Finish
    ctx.fillStyle = '#f8fafc' 
    ctx.fillRect(0, 0, 1024, 1024)

    // Coordinate mappings
    const toCanvasX = (wx: number) => ((wx + w / 2) / w) * 1024
    const toCanvasY = (wz: number) => ((wz + l / 2) / l) * 1024
    const toCanvasW = (wd: number) => (wd / w) * 1024
    const toCanvasH = (lg: number) => (lg / l) * 1024

    // 2. Beveled Tile Joints
    ctx.strokeStyle = '#e2e8f0' 
    ctx.lineWidth = 2
    for (let x = -w / 2; x <= w / 2; x += 1.0) {
      const cx = toCanvasX(x)
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, 1024)
      ctx.stroke()
    }
    for (let z = -l / 2; z <= l / 2; z += 1.0) {
      const cy = toCanvasY(z)
      ctx.beginPath()
      ctx.moveTo(0, cy)
      ctx.lineTo(1024, cy)
      ctx.stroke()
    }

    // Specular bevel lines
    ctx.strokeStyle = '#ffffff' 
    ctx.lineWidth = 1
    for (let x = -w / 2 + 0.05; x <= w / 2; x += 1.0) {
      const cx = toCanvasX(x)
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, 1024)
      ctx.stroke()
    }
    for (let z = -l / 2 + 0.05; z <= l / 2; z += 1.0) {
      const cy = toCanvasY(z)
      ctx.beginPath()
      ctx.moveTo(0, cy)
      ctx.lineTo(1024, cy)
      ctx.stroke()
    }

    // 3. Render standard rows inside the texture (Relative Center)
    const standardRows = [
      { id: 'ROW-1', z: -6, aisleType: 'cold' as const },
      { id: 'ROW-2', z: -2, aisleType: 'hot' as const },
      { id: 'ROW-3', z: 2, aisleType: 'cold' as const },
      { id: 'ROW-4', z: 6, aisleType: 'hot' as const }
    ]

    standardRows.forEach(row => {
      const isCold = row.aisleType === 'cold'
      const startCol = -Math.floor(facilityColumnsCount / 2)
      const endCol = Math.floor(facilityColumnsCount / 2)

      const rx = toCanvasX(startCol - 0.5)
      const rz = toCanvasY(row.z - 0.5)
      const rw = toCanvasW(facilityColumnsCount)
      const rh = toCanvasH(1.0)

      // Soft row background track
      ctx.fillStyle = isCold ? 'rgba(14, 165, 233, 0.04)' : 'rgba(249, 115, 22, 0.03)'
      ctx.fillRect(rx, rz, rw, rh)

      // Airflow grates for cold aisles
      if (isCold) {
        for (let col = startCol; col <= endCol; col++) {
          const tx = toCanvasX(col - 0.45)
          const tz = toCanvasY(row.z - 0.45)
          const tw = toCanvasW(0.9)
          const th = toCanvasH(0.9)

          ctx.strokeStyle = '#bae6fd'
          ctx.lineWidth = 1.5
          ctx.strokeRect(tx, tz, tw, th)

          ctx.fillStyle = '#0ea5e9'
          for (let dx = tx + 3; dx < tx + tw - 3; dx += 5) {
            for (let dy = tz + 3; dy < tz + th - 3; dy += 5) {
              ctx.beginPath()
              ctx.arc(dx, dy, 1.0, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      } else {
        // Hot aisle warnings
        for (let col = startCol; col <= endCol; col++) {
          const tx = toCanvasX(col - 0.45)
          const tz = toCanvasY(row.z - 0.45)
          const tw = toCanvasW(0.9)
          const th = toCanvasH(0.9)
          ctx.strokeStyle = '#fdba74'
          ctx.lineWidth = 1.2
          ctx.strokeRect(tx, tz, tw, th)
        }
      }

      // 4. Paint Row Labels
      ctx.fillStyle = '#64748b'
      ctx.font = 'bold 9px "Outfit", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const label = `${row.id} [${row.aisleType.toUpperCase()}]`
      ctx.fillText(label, toCanvasX(startCol - 2.5), toCanvasY(row.z))
      ctx.fillText(label, toCanvasX(endCol + 2.5), toCanvasY(row.z))
    })

    // 5. Walkway safety stripes (diagonal yellow/black border ticks)
    const stripeW = 10
    ctx.save()
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 4
    for (let x = 0; x < 1024; x += stripeW * 2) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + stripeW, stripeW)
      ctx.stroke()
    }
    for (let x = 0; x < 1024; x += stripeW * 2) {
      ctx.beginPath()
      ctx.moveTo(x, 1024 - stripeW)
      ctx.lineTo(x + stripeW, 1024)
      ctx.stroke()
    }
    ctx.restore()

    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = 16
    return tex
  }, [facilityColumnsCount])

  // Generate holographic expansion markers on exposed adjacent coordinates
  const expansionMarkers = useMemo(() => {
    const markers: { x: number; z: number; hx: number; hz: number; direction: 'N' | 'S' | 'E' | 'W' }[] = []

    halls.forEach((hall) => {
      const neighbors = [
        { dir: 'N' as const, tx: hall.x, tz: hall.z - 1, mx: hall.x * 30, mz: hall.z * 30 - 17.5 },
        { dir: 'S' as const, tx: hall.x, tz: hall.z + 1, mx: hall.x * 30, mz: hall.z * 30 + 17.5 },
        { dir: 'W' as const, tx: hall.x - 1, tz: hall.z, mx: hall.x * 30 - 17.5, mz: hall.z * 30 },
        { dir: 'E' as const, tx: hall.x + 1, tz: hall.z, mx: hall.x * 30 + 17.5, mz: hall.z * 30 }
      ]

      neighbors.forEach((n) => {
        // Only allow expansions within a 5x5 grid (grid index -2 to 2)
        if (Math.abs(n.tx) <= 2 && Math.abs(n.tz) <= 2) {
          const neighborExists = halls.some((h) => h.x === n.tx && h.z === n.tz)
          if (!neighborExists) {
            const alreadyAdded = markers.some((m) => m.hx === hall.x && m.hz === hall.z && m.direction === n.dir)
            if (!alreadyAdded) {
              markers.push({ x: n.mx, z: n.mz, hx: hall.x, hz: hall.z, direction: n.dir })
            }
          }
        }
      })
    })

    return markers
  }, [halls])

  return (
    <>
      {/* 1. Large Unified Pointer Raycasting Plane (size 150m x 150m) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onPointerMove={(e) => {
          if (!placementMode) return
          const nearest = findNearestSlot(e.point.x, e.point.z, 2.5)
          if (nearest) {
            setGhostPos(new THREE.Vector3(nearest.x, 0, nearest.z))
          } else {
            setGhostPos(null)
          }
        }}
        onClick={(e) => {
          if (!placementMode || !ghostPos) {
            dispatchIntent({ type: 'DESELECT_NODE' })
            return
          }
          e.stopPropagation()

          const isOccupied = nodes.some(
            n =>
              n.type === 'rack' &&
              n.siteId === currentSiteId &&
              Math.round(n.position.x) === ghostPos.x &&
              Math.round(n.position.z) === ghostPos.z
          )
          if (isOccupied) return

          dispatchIntent({
            type: 'PLACE_NODE',
            payload: { position: { x: ghostPos.x, y: ghostPos.y, z: ghostPos.z } }
          })
          setGhostPos(null)
        }}
      >
        <planeGeometry args={[150, 150]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* 2. Modular Epoxy Raised Floor Grids (One mesh per active hall) */}
      {halls.map((hall) => (
        <mesh 
          key={hall.id}
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[hall.x * 30, -0.012, hall.z * 30]} 
          receiveShadow
        >
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial 
            map={texture || undefined}
            roughness={0.16} 
            metalness={0.4} 
          />
        </mesh>
      ))}

      {/* 3. Predefined Snap Slot Highlights (Only visible in placement mode) */}
      {placementMode && PREDEFINED_SLOTS.map((slot, idx) => {
        const isOccupied = nodes.some(
          n =>
            n.type === 'rack' &&
            n.siteId === currentSiteId &&
            Math.round(n.position.x) === slot.x &&
            Math.round(n.position.z) === slot.z
        )

        return (
          <group key={idx} position={[slot.x, 0.005, slot.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <lineSegments>
              <edgesGeometry>
                <planeGeometry args={[0.94, 0.94]} />
              </edgesGeometry>
              <lineBasicMaterial
                color={isOccupied ? '#ef4444' : '#10b981'}
                opacity={0.8}
                transparent
              />
            </lineSegments>
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.1, 0.1]} />
              <meshBasicMaterial 
                color={isOccupied ? '#ef4444' : '#10b981'} 
                transparent 
                opacity={0.5} 
              />
            </mesh>
          </group>
        )
      })}

      {/* 4. Placement Snap Ghost Preview */}
      {placementMode && ghostPos && (
        <group position={[ghostPos.x, ghostPos.y + RACK_HEIGHT / 2, ghostPos.z]}>
          <mesh>
            <boxGeometry args={[0.98, RACK_HEIGHT, 0.98]} />
            <meshStandardMaterial
              color={ghostOccupied ? '#ef4444' : '#10b981'}
              transparent
              opacity={0.4}
              roughness={0.2}
              metalness={0.5}
            />
            <Edges color={ghostOccupied ? '#dc2626' : '#059669'} lineWidth={2} />
          </mesh>
        </group>
      )}

      {/* 5. 3D Architectural Holographic Expansion Buttons */}
      {!placementMode && expansionMarkers.map((marker, idx) => (
        <HoloIndicator
          key={idx}
          x={marker.x}
          z={marker.z}
          hx={marker.hx}
          hz={marker.hz}
          direction={marker.direction}
          onExpand={expandHallDirection}
        />
      ))}

      {/* 6. Datacenter Core Details: 3D Row Labels & Emergency Signs */}
      {halls.map((hall) => {
        const standardRows = [
          { id: 'ROW-A', z: -6, aisleType: 'cold' as const },
          { id: 'ROW-B', z: -2, aisleType: 'hot' as const },
          { id: 'ROW-C', z: 2, aisleType: 'cold' as const },
          { id: 'ROW-D', z: 6, aisleType: 'hot' as const }
        ]
        const startCol = -Math.floor(facilityColumnsCount / 2)
        const endCol = Math.floor(facilityColumnsCount / 2)
        
        return (
          <group key={`core-details-${hall.id}`}>
            {standardRows.map(row => (
              <group key={row.id}>
                {/* Left side label */}
                <Text
                  position={[hall.x * 30 + (startCol - 1.5), 0.05, hall.z * 30 + row.z]}
                  rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                  fontSize={0.6}
                  color={row.aisleType === 'cold' ? '#38bdf8' : '#fb923c'}
                  anchorX="center"
                  anchorY="middle"
                  outlineColor="#020617"
                  outlineWidth={0.08}
                >
                  {row.id}
                </Text>
                {/* Right side label */}
                <Text
                  position={[hall.x * 30 + (endCol + 1.5), 0.05, hall.z * 30 + row.z]}
                  rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
                  fontSize={0.6}
                  color={row.aisleType === 'cold' ? '#38bdf8' : '#fb923c'}
                  anchorX="center"
                  anchorY="middle"
                  outlineColor="#020617"
                  outlineWidth={0.08}
                >
                  {row.id}
                </Text>
              </group>
            ))}
            
            {/* Emergency Exit Signs on Floor boundaries */}
            <Text
              position={[hall.x * 30, 0.05, hall.z * 30 + 13.5]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.8}
              color="#22c55e"
              outlineColor="#064e3b"
              outlineWidth={0.08}
            >
              EXIT
            </Text>
            <Text
              position={[hall.x * 30, 0.05, hall.z * 30 - 13.5]}
              rotation={[-Math.PI / 2, 0, Math.PI]}
              fontSize={0.8}
              color="#22c55e"
              outlineColor="#064e3b"
              outlineWidth={0.08}
            >
              EXIT
            </Text>
          </group>
        )
      })}
    </>
  )
}
