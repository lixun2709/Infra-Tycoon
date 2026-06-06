/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { useInput } from '../../../contexts/InputContext'
import { audioManager } from '../../../utils/AudioManager'
import { cameraTelemetry } from '../../../systems/camera/CameraTelemetry'
import { 
  computeRTSPlanarMove, 
  computeSlotInspectionTarget, 
  lerpCameraVec3 
} from '../../../systems/camera/cameraModes'
import { clampCameraPosition } from '../../../systems/camera/cameraCollider'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

// Pre-allocate vectors to eliminate per-frame Garbage Collection spikes
const V_TARGET_POS = new THREE.Vector3()
const V_CAMERA_TARGET = new THREE.Vector3()
const V_CAMERA_OFFSET = new THREE.Vector3(3, 2, -3) // Inverted Z offset for cold aisle placement
const V_MAP_POS = new THREE.Vector3(15, 12, 15)
const V_SITE_POS = new THREE.Vector3(0, 6, 20)
const V_ZERO = new THREE.Vector3(0, 0, 0)

export function CameraController() {
  const { camera, controls } = useThree()
  
  const isGlobalMapOpen = useInfraStore(s => s.isGlobalMapOpen)
  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  const nodes = useInfraStore(useShallow(s => s.nodes))
  
  const cameraMode = useInfraStore(s => s.cameraMode)
  const cameraFocusNodeId = useInfraStore(s => s.cameraFocusNodeId)
  const cameraFocusPosition = useInfraStore(s => s.cameraFocusPosition)
  const setCameraMode = useInfraStore(s => s.setCameraMode)
  const focusOnNode = useInfraStore(s => s.focusOnNode)
  
  const { isActionActive } = useInput()
  const prevSiteId = useRef(currentSiteId)

  // Initialize Audio Listener on the primary camera
  useEffect(() => {
    audioManager.init(camera)
  }, [camera])

  // Input Abstraction: Detect when user manually interacts with controls and switch to free roam
  useEffect(() => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsImpl
    const handleStart = () => { 
      if (cameraMode !== 'MANUAL_FREE') {
        cameraTelemetry.log('mode_change', `User manually panned camera. Releasing to MANUAL_FREE from ${cameraMode}`)
        setCameraMode('MANUAL_FREE')
      }
    }
    orbitControls.addEventListener('start', handleStart)
    return () => orbitControls.removeEventListener('start', handleStart)
  }, [controls, cameraMode, setCameraMode])

  // Synchronize dynamic store states with Camera Subsystem modes
  useEffect(() => {
    if (isGlobalMapOpen) {
      if (cameraMode !== 'GLOBAL_MAP') {
        cameraTelemetry.log('mode_change', 'Global map opened. Switching camera to GLOBAL_MAP preset.')
        setCameraMode('GLOBAL_MAP')
      }
      return
    }
    if (prevSiteId.current !== currentSiteId) {
      prevSiteId.current = currentSiteId
      cameraTelemetry.log('mode_change', `Site switched to ${currentSiteId}. Snapping to SITE_DEFAULT preset.`)
      setCameraMode('SITE_DEFAULT')
      return
    }
    if (selectedNodeId) {
      if (cameraFocusNodeId !== selectedNodeId) {
        cameraTelemetry.log('focus_node', `Node ${selectedNodeId} selected. Focusing camera in INSPECT mode.`, { nodeId: selectedNodeId })
        focusOnNode(selectedNodeId)
      }
      return
    }
    
    // Auto-release focus when node and custom position are both deselected
    if (cameraMode === 'INSPECT' && !selectedNodeId && !cameraFocusPosition) {
      cameraTelemetry.log('mode_change', 'Selection cleared. Resetting camera back to SITE_DEFAULT.')
      focusOnNode(null)
    }
  }, [isGlobalMapOpen, currentSiteId, selectedNodeId, cameraMode, cameraFocusNodeId, cameraFocusPosition, setCameraMode, focusOnNode])

  // High-performance Render Loop utilising preallocated vector pools
  useFrame((_, delta) => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsImpl

    switch (cameraMode) {
      case 'GLOBAL_MAP': {
        lerpCameraVec3(camera.position, V_MAP_POS, 2.5, delta, camera.position)
        lerpCameraVec3(orbitControls.target, V_ZERO, 2.5, delta, orbitControls.target)
        break
      }
        
      case 'SITE_DEFAULT': {
        lerpCameraVec3(camera.position, V_SITE_POS, 5.0, delta, camera.position)
        lerpCameraVec3(orbitControls.target, V_ZERO, 5.0, delta, orbitControls.target)
        
        if (camera.position.distanceTo(V_SITE_POS) < 0.1) {
          cameraTelemetry.log('mode_change', 'Default site snaps finished. Transitioning to MANUAL_FREE controls.')
          setCameraMode('MANUAL_FREE')
        }
        break
      }

      case 'INSPECT': {
        const inspectNodeId = cameraFocusNodeId || selectedNodeId
        if (inspectNodeId) {
          const selectedNode = nodes.find((n: any) => n.id === inspectNodeId)
          if (selectedNode) {
            const parentRack = selectedNode.parentRackId 
              ? nodes.find((n: any) => n.id === selectedNode.parentRackId) 
              : undefined

            // Delegate 3D coordinates calculation to decoupled math routines
            computeSlotInspectionTarget(selectedNode, parentRack, V_TARGET_POS)

            // Smoothly pan OrbitControls target to look at the focused slot position
            lerpCameraVec3(orbitControls.target, V_TARGET_POS, 12, delta, orbitControls.target)
            
            // Smoothly zoom the camera position to maintain offset
            V_CAMERA_TARGET.copy(V_TARGET_POS).add(V_CAMERA_OFFSET)
            lerpCameraVec3(camera.position, V_CAMERA_TARGET, 5, delta, camera.position)
          }
        } else if (cameraFocusPosition) {
          // Smoothly pan OrbitControls target to look at the focused custom position
          V_TARGET_POS.set(cameraFocusPosition.x, cameraFocusPosition.y, cameraFocusPosition.z)
          lerpCameraVec3(orbitControls.target, V_TARGET_POS, 12, delta, orbitControls.target)
          
          // Smoothly zoom the camera position to maintain offset
          V_CAMERA_TARGET.copy(V_TARGET_POS).add(V_CAMERA_OFFSET)
          lerpCameraVec3(camera.position, V_CAMERA_TARGET, 5, delta, camera.position)
        }
        break
      }

      case 'MANUAL_FREE': {
        let moveX = 0
        let moveZ = 0
        
        if (isActionActive('MOVE_FORWARD')) moveZ -= 1
        if (isActionActive('MOVE_BACKWARD')) moveZ += 1
        if (isActionActive('MOVE_LEFT')) moveX -= 1
        if (isActionActive('MOVE_RIGHT')) moveX += 1
        
        if (moveX !== 0 || moveZ !== 0) {
          // Compute yaw angle relative to orbital rotation target
          const yaw = Math.atan2(
            camera.position.x - orbitControls.target.x,
            camera.position.z - orbitControls.target.z
          )
          
          // Delegate panning kinematics directly to cameraModes
          computeRTSPlanarMove(yaw, moveX, moveZ, 15, delta, orbitControls.target, camera.position)
        }
        break
      }
    }

    // Apply bounds enforcement to limit all panning (both keyboard and mouse-drag)
    clampCameraPosition(orbitControls.target, camera.position)

    orbitControls.update()
  })

  return (
    <OrbitControls
      makeDefault
      enableDamping={true}
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={1.5}
      minDistance={0.5}
      maxDistance={100}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enablePan={true}
      screenSpacePanning={true}
    />
  )
}

