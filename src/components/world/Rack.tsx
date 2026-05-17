import React, { type ReactNode } from 'react'
import { Text, Edges, Line } from '@react-three/drei'
import { RACK_HEIGHT, U_WORLD, RACK_U } from '../../physics/dimensions'
import { useInteractable } from '../../hooks/useInteraction'
import { useInfraStore } from '../../store/useInfraStore'
import { THEMES } from '../../store/themeTypes'

interface RackProps {
  id: string
  name: string
  currentPowerKW: number
  maxPowerKW: number
  status: string
  position: { x: number; y: number; z: number }
  isSelected: boolean
  children?: ReactNode
}

function USlotLines() {
  const activeTheme = useInfraStore(s => s.activeTheme)
  const themeSpec = THEMES[activeTheme]

  const segments = React.useMemo(() => {
    const out: { key: number; y: number }[] = []
    for (let j = 1; j <= RACK_U; j++) {
      const y = -RACK_HEIGHT / 2 + j * U_WORLD
      out.push({ key: j, y })
    }
    return out
  }, [])

  return (
    <>
      {segments.map(({ key, y }) => (
        <Line
          key={key}
          points={[[-0.501, y, 0.502], [0.501, y, 0.502]]}
          color={themeSpec.render.rackBoundHover}
          lineWidth={1}
          opacity={0.3}
          transparent
        />
      ))}
    </>
  )
}

function RackComponent({ id, name, currentPowerKW, maxPowerKW, status, position, isSelected, children }: RackProps) {
  const isOverload = status === 'power_overload'
  const powerText = `${currentPowerKW.toFixed(1)} / ${maxPowerKW.toFixed(1)} kW`
  
  const { isHovered, interactionProps } = useInteractable(id, 'RACK')
  const activeTheme = useInfraStore(s => s.activeTheme)
  const themeSpec = THEMES[activeTheme]

  return (
    <group position={[position.x, position.y + RACK_HEIGHT / 2, position.z]}>
      <mesh>
        <boxGeometry args={[1, RACK_HEIGHT, 1]} />
        <meshStandardMaterial
          color={isOverload ? themeSpec.render.rackStatusOverload : '#2d3748'}
          emissive={isOverload ? themeSpec.render.rackStatusOverload : '#000000'}
          emissiveIntensity={isOverload ? 0.8 : 0}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={isOverload ? 0.3 : 0.4}
          depthWrite={false}
        />
        <Edges 
          color={isSelected ? themeSpec.render.rackBoundSelected : (isHovered ? themeSpec.render.rackBoundHover : (isOverload ? themeSpec.render.rackStatusOverload : themeSpec.render.rackBound))} 
          threshold={14} 
          lineWidth={isSelected || isHovered ? 3 : 1.5} 
        />
      </mesh>

      <USlotLines />
      <Text 
        {...interactionProps}
        position={[0, RACK_HEIGHT / 2 + 0.15, 0]} 
        fontSize={0.1} 
        color={isOverload ? themeSpec.render.rackStatusOverload : '#031225'} 
        outlineColor="#ffffff" 
        outlineWidth={0.01}
      >
        {name}
      </Text>
      <Text position={[0, RACK_HEIGHT / 2 + 0.02, 0]} fontSize={0.07} color={isOverload ? themeSpec.render.rackStatusOverload : '#031225'} outlineColor="#ffffff" outlineWidth={0.005}>
        {powerText}
      </Text>
      {children}
    </group>
  )
}

export const Rack = React.memo(RackComponent)
