import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import { audioManager } from '../../../utils/AudioManager'
import { RACK_HEIGHT, U_WORLD } from '../../../physics/dimensions'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

// Camera State Machine Types
export type CameraMode = 'GLOBAL_MAP' | 'SITE_DEFAULT' | 'INSPECT' | 'MANUAL_FREE'

// Pre-allocate vectors to eliminate per-frame Garbage Collection spikes
const V_TARGET_POS = new THREE.Vector3()
const V_CAMERA_TARGET = new THREE.Vector3()
const V_CAMERA_OFFSET = new THREE.Vector3(3, 2, 3)
const V_MAP_POS = new THREE.Vector3(15, 12, 15)
const V_SITE_POS = new THREE.Vector3(5, 4, 5)
const V_ZERO = new THREE.Vector3(0, 0, 0)

export function CameraController() {
  const { camera, controls } = useThree()
  
  const isGlobalMapOpen = useInfraStore(s => s.isGlobalMapOpen)
  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  const nodes = useInfraStore(s => s.nodes)

  const mode = useRef<CameraMode>('SITE_DEFAULT')
  const prevSiteId = useRef(currentSiteId)

  // Initialize Audio Listener on the primary camera
  useEffect(() => {
    audioManager.init(camera)
  }, [camera])

  // Input Abstraction: Detect when user manually interacts with controls
  useEffect(() => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsImpl
    const handleStart = () => { 
      mode.current = 'MANUAL_FREE'
    }
    orbitControls.addEventListener('start', handleStart)
    return () => orbitControls.removeEventListener('start', handleStart)
  }, [controls])

  // State Machine Evaluation
  useEffect(() => {
    if (isGlobalMapOpen) {
      mode.current = 'GLOBAL_MAP'
      return
    }
    if (prevSiteId.current !== currentSiteId) {
      mode.current = 'SITE_DEFAULT'
      prevSiteId.current = currentSiteId
      return
    }
    if (selectedNodeId) {
      mode.current = 'INSPECT'
      return
    }
    
    // Default fallback logic when deselected: Zoom back out to the room view
    if (mode.current === 'INSPECT' && !selectedNodeId) {
       mode.current = 'SITE_DEFAULT' 
    }
  }, [isGlobalMapOpen, currentSiteId, selectedNodeId])

  // High-performance Render Loop
  useFrame((_, delta) => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsImpl

    switch (mode.current) {
      case 'GLOBAL_MAP':
        camera.position.lerp(V_MAP_POS, 0.05)
        orbitControls.target.lerp(V_ZERO, 0.05)
        break
        
      case 'SITE_DEFAULT':
        camera.position.lerp(V_SITE_POS, 0.1)
        orbitControls.target.lerp(V_ZERO, 0.1)
        if (camera.position.distanceTo(V_SITE_POS) < 0.1) {
          mode.current = 'MANUAL_FREE' // Release back to player after snapping
        }
        break

      case 'INSPECT':
        if (selectedNodeId) {
          const selectedNode = nodes.find(n => n.id === selectedNodeId)
          if (selectedNode) {
            // Re-use preallocated vector
            V_TARGET_POS.set(selectedNode.position.x, selectedNode.position.y, selectedNode.position.z)
            
            // Compute specific sub-offsets
            if (selectedNode.parentRackId) {
              const rack = nodes.find(n => n.id === selectedNode.parentRackId)
              if (rack) {
                const yOffset = -RACK_HEIGHT / 2 + U_WORLD * ((selectedNode.slotIndex ?? 1) - 1 + selectedNode.uHeight / 2)
                V_TARGET_POS.set(rack.position.x, rack.position.y + RACK_HEIGHT / 2 + yOffset, rack.position.z)
              }
            } else if (selectedNode.type === 'rack') {
              V_TARGET_POS.y += RACK_HEIGHT / 2
            }

            // Smoothly pan the target
            orbitControls.target.lerp(V_TARGET_POS, delta * 12)
            
            // Smoothly zoom the camera position in
            V_CAMERA_TARGET.copy(V_TARGET_POS).add(V_CAMERA_OFFSET)
            camera.position.lerp(V_CAMERA_TARGET, delta * 5)
          }
        }
        break

      case 'MANUAL_FREE':
        // No programmatic intervention required; OrbitControls runs natively
        break
    }

    orbitControls.update()
  })

  // Future abstraction point: Replace OrbitControls with RTS/Spectator WASD controls based on state
  return (
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
  )
}
