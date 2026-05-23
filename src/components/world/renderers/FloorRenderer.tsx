import { useState } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { useInput } from '../../../contexts/InputContext'
import { RACK_HEIGHT } from '../../../physics/dimensions'
import { PREDEFINED_SLOTS, findNearestSlot } from '../../../physics/zoning'

export function FloorRenderer() {
  const { placementMode, nodes, currentSiteId } = useInfraStore()
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

  return (
    <>
      {/* 1. Standard Interactive Floor Plane for mouse raycasting */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onPointerMove={(e) => {
          if (!placementMode) return
          // Snap strictly to the nearest predefined slot coordinate
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

          // Prevent overlapping rack placement in an occupied slot
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
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* 2. Predefined Industrial Floor Slot Outlines */}
      {PREDEFINED_SLOTS.map((slot, idx) => {
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
                <planeGeometry args={[0.92, 0.92]} />
              </edgesGeometry>
              <lineBasicMaterial
                color={placementMode ? (isOccupied ? '#ef4444' : '#10b981') : '#475569'}
                opacity={placementMode ? 0.75 : 0.3}
                transparent
              />
            </lineSegments>
            {/* Center tick indicator for spatial readability */}
            <mesh position={[0, 0, 0.001]}>
              <planeGeometry args={[0.08, 0.08]} />
              <meshBasicMaterial 
                color={placementMode ? (isOccupied ? '#ef4444' : '#10b981') : '#64748b'} 
                transparent 
                opacity={0.4} 
              />
            </mesh>
          </group>
        )
      })}

      {/* 3. Snapped trans-lucid placement preview ghost */}
      {placementMode && ghostPos && (
        <group position={[ghostPos.x, ghostPos.y + RACK_HEIGHT / 2, ghostPos.z]}>
          <mesh>
            <boxGeometry args={[0.98, RACK_HEIGHT, 0.98]} />
            <meshStandardMaterial
              color={ghostOccupied ? '#ef4444' : '#10b981'}
              transparent
              opacity={0.45}
              roughness={0.2}
              metalness={0.5}
            />
            <Edges color={ghostOccupied ? '#dc2626' : '#059669'} lineWidth={2} />
          </mesh>
        </group>
      )}
    </>
  )
}
