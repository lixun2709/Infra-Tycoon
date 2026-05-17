import { useState, useCallback, useEffect } from 'react'
import { useInput } from '../contexts/InputContext'
import type { ThreeEvent } from '@react-three/fiber'

export function useInteractable(nodeId: string, nodeType: 'RACK' | 'NODE' | 'FLOOR') {
  const [isHovered, setIsHovered] = useState(false)
  const { dispatchIntent } = useInput()

  const onPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setIsHovered(true)
    document.body.style.cursor = 'pointer'
  }, [])

  const onPointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setIsHovered(false)
    document.body.style.cursor = 'default'
  }, [])

  const onClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (nodeType !== 'FLOOR') {
      dispatchIntent({ type: 'SELECT_NODE', payload: { nodeId } })
    }
  }, [dispatchIntent, nodeId, nodeType])

  // Cleanup cursor on unmount
  useEffect(() => {
    return () => {
      if (isHovered) {
        document.body.style.cursor = 'default'
      }
    }
  }, [isHovered])

  return {
    isHovered,
    interactionProps: {
      onPointerOver,
      onPointerOut,
      onClick
    }
  }
}
