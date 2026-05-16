import { Grid, OrbitControls } from '@react-three/drei'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import { audioManager } from '../../../utils/AudioManager'
import { RACK_HEIGHT, U_WORLD } from '../../../physics/dimensions'

export function EnvironmentRenderer() {
  const { totalRoomBTU, isGlobalMapOpen, currentSiteId, nodes, selectedNodeId } = useInfraStore()
  const isHot = totalRoomBTU > 50000
  const { camera, controls } = useThree()
  
  const prevSiteId = useRef(currentSiteId)
  const prevMapState = useRef(isGlobalMapOpen)
  const [isManualOverride, setIsManualOverride] = useState(false)
  const prevSelectedId = useRef(selectedNodeId)

  // Initialize Audio
  useEffect(() => {
    audioManager.init(camera)
  }, [camera])

  // Camera Animation Logic
  useEffect(() => {
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

    const targetPos = new THREE.Vector3(selectedNode.position.x, selectedNode.position.y, selectedNode.position.z)

    // Handle nested node position calculation
    if (selectedNode.parentRackId) {
      const rack = nodes.find(n => n.id === selectedNode.parentRackId)
      if (rack) {
        const yOffset = -RACK_HEIGHT / 2 + U_WORLD * ((selectedNode.slotIndex ?? 1) - 1 + selectedNode.uHeight / 2)
        targetPos.set(rack.position.x, rack.position.y + RACK_HEIGHT / 2 + yOffset, rack.position.z)
      }
    } else if (selectedNode.type === 'rack') {
      targetPos.y += RACK_HEIGHT / 2
    }

    (controls as any).target.lerp(targetPos, delta * 12)
    ;(controls as any).update()
  })

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
    </>
  )
}
