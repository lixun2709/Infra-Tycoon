import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'
import { InputProcessor } from '../../../systems/interaction/InputProcessor'

export function InteractionController() {
  const { camera, raycaster, pointer } = useThree()
  const setMousePosition = useInfraStore(s => s.setMousePosition)
  const frameCounter = useRef(0)
  const lastMousePos = useRef<THREE.Vector3>(new THREE.Vector3())
  const planeRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  useFrame(() => {
    frameCounter.current++
    
    // Throttled mouse positioning once every 4 frames (reduces allocation, improves CPU efficiency)
    if (frameCounter.current % 4 === 0) {
      raycaster.setFromCamera(pointer, camera)
      const targetPos = new THREE.Vector3()
      
      if (raycaster.ray.intersectPlane(planeRef.current, targetPos)) {
        if (!targetPos.equals(lastMousePos.current)) {
          lastMousePos.current.copy(targetPos)
          setMousePosition(targetPos)
        }
      }
    }
  })

  // Set up window keyboard and cancellation bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys when user is typing inside interactive inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

      if (e.code === 'Escape') {
        InputProcessor.getInstance().enqueueIntent({ type: 'DESELECT_NODE' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}
