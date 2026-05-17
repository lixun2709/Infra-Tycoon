import { useState } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { useInput } from '../../../contexts/InputContext'
import { RACK_HEIGHT } from '../../../physics/dimensions'

export function FloorRenderer() {
  const { placementMode } = useInfraStore()
  const { dispatchIntent } = useInput()
  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null)

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onPointerMove={(e) => {
          if (!placementMode) return
          const x = Math.round(e.point.x)
          const z = Math.round(e.point.z)
          setGhostPos(new THREE.Vector3(x, 0, z))
        }}
        onClick={(e) => {
          if (!placementMode || !ghostPos) {
            dispatchIntent({ type: 'DESELECT_NODE' })
            return
          }
          e.stopPropagation()
          dispatchIntent({ type: 'PLACE_NODE', payload: { position: { x: ghostPos.x, y: ghostPos.y, z: ghostPos.z } } })
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
