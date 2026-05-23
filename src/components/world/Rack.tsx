import React, { type ReactNode, useMemo, useRef, useEffect } from 'react'
import { Text, Edges, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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
  containmentType?: 'none' | 'cold_aisle' | 'hot_aisle'
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

interface ContainmentFlowProps {
  containmentType: 'cold_aisle' | 'hot_aisle'
  ambientTemp: number
}

function ContainmentFlowComponent({ containmentType, ambientTemp }: ContainmentFlowProps) {
  const isHeatMapVisible = useInfraStore(s => s.isHeatMapVisible)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uSpeed;
        uniform float uDensity;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          float flow = sin((vUv.y - uTime * uSpeed) * uDensity) * 0.5 + 0.5;
          float wave = sin(vUv.x * 6.0 + uTime) * 0.05;
          float flowCombined = sin((vUv.y + wave - uTime * uSpeed) * uDensity) * 0.5 + 0.5;
          
          float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(0.0, 0.1, 1.0 - vUv.x);
          float verticalFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(0.0, 0.15, 1.0 - vUv.y);
          
          gl_FragColor = vec4(uColor, flowCombined * edgeFade * verticalFade * uOpacity);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uColor: { value: new THREE.Color(containmentType === 'cold_aisle' ? '#00f2ff' : '#f97316') },
        uSpeed: { value: containmentType === 'cold_aisle' ? -1.0 : 1.5 },
        uDensity: { value: 10.0 },
        uOpacity: { value: 0.15 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  }, [containmentType])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    const time = clock.getElapsedTime()
    materialRef.current.uniforms.uTime!.value = time

    const baseColor = new THREE.Color()
    if (containmentType === 'cold_aisle') {
      if (ambientTemp <= 24) {
        baseColor.set('#00f2ff')
      } else if (ambientTemp >= 35) {
        baseColor.set('#f97316')
      } else {
        const t = (ambientTemp - 24) / (35 - 24)
        baseColor.set('#00f2ff').lerp(new THREE.Color('#f97316'), t)
      }
    } else {
      if (ambientTemp <= 25) {
        baseColor.set('#f97316')
      } else {
        baseColor.set('#ef4444')
      }
    }
    
    materialRef.current.uniforms.uColor!.value.copy(baseColor)
    
    const baseOpacity = containmentType === 'cold_aisle' ? 0.12 : 0.18
    const heatmapBoost = isHeatMapVisible ? 1.8 : 1.0
    materialRef.current.uniforms.uOpacity!.value = baseOpacity * heatmapBoost
  })

  const zPos = containmentType === 'cold_aisle' ? 0.541 : -0.541

  return (
    <mesh position={[0, 0, zPos]}>
      <planeGeometry args={[1.08, RACK_HEIGHT]} />
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  )
}

const ContainmentFlow = React.memo(ContainmentFlowComponent)



function RackComponent({ id, name, currentPowerKW, maxPowerKW, status, position, isSelected, containmentType = 'none', children }: RackProps) {
  const isOverload = status === 'power_overload'
  const powerText = `${currentPowerKW.toFixed(1)} / ${maxPowerKW.toFixed(1)} kW`
  
  const { isHovered, interactionProps } = useInteractable(id, 'RACK')
  const activeTheme = useInfraStore(s => s.activeTheme)
  const themeSpec = THEMES[activeTheme]



  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const sites = useInfraStore(s => s.sites)
  const currentSite = sites.find(site => site.id === currentSiteId)
  const ambientTemp = currentSite?.ambientTemp ?? 22.0

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


      {/* Rear Exhaust Chassis Visual Details */}
      <group position={[0, 0, -0.501]} rotation={[0, Math.PI, 0]}>
        <lineSegments>
          <edgesGeometry>
            <planeGeometry args={[1, RACK_HEIGHT]} />
          </edgesGeometry>
          <lineBasicMaterial color="#334155" linewidth={1.5} />
        </lineSegments>
        <mesh>
          <planeGeometry args={[0.96, RACK_HEIGHT * 0.98]} />
          <meshStandardMaterial
            color="#020617"
            transparent
            opacity={0.3}
            metalness={0.9}
            roughness={0.6}
          />
        </mesh>
      </group>

      {containmentType && containmentType !== 'none' && (
        <>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.08, RACK_HEIGHT * 1.002, 1.08]} />
            <meshStandardMaterial
              color={containmentType === 'cold_aisle' ? '#00f2ff' : '#ff5a36'}
              transparent
              opacity={0.15}
              roughness={0.1}
              metalness={0.9}
              depthWrite={false}
            />
            <Edges
              color={containmentType === 'cold_aisle' ? '#00f2ff' : '#ff5a36'}
              threshold={24}
              lineWidth={2.0}
            />
          </mesh>
          <ContainmentFlow containmentType={containmentType} ambientTemp={ambientTemp} />
        </>
      )}



      <USlotLines />

      {/* 3-Phase PDU Strip on the Rear Side */}
      <group position={[0.465, 0, -0.502]} rotation={[0, Math.PI, 0]}>
        {/* Background track for the PDU strip */}
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[0.07, RACK_HEIGHT]} />
          <meshStandardMaterial color="#111827" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Border edges around the PDU strip */}
        <lineSegments>
          <edgesGeometry>
            <planeGeometry args={[0.07, RACK_HEIGHT]} />
          </edgesGeometry>
          <lineBasicMaterial color="#475569" linewidth={1.5} />
        </lineSegments>
        
        {/* Outlets & Phase Partitions */}
        {React.useMemo(() => {
          const outlets: React.ReactNode[] = []
          for (let j = 1; j <= RACK_U; j++) {
            const slotY = -RACK_HEIGHT / 2 + (j - 0.5) * U_WORLD
            const phase = ['A', 'B', 'C'][j % 3] as 'A' | 'B' | 'C'
            const phaseColor = phase === 'A' ? '#f43f5e' : phase === 'B' ? '#06b6d4' : '#eab308'
            outlets.push(
              <group key={j} position={[0, slotY, 0.001]}>
                {/* Glowing Outlet Slot */}
                <mesh>
                  <planeGeometry args={[0.024, U_WORLD * 0.6]} />
                  <meshStandardMaterial 
                    color={phaseColor}
                    emissive={phaseColor}
                    emissiveIntensity={1.4}
                    transparent
                    opacity={0.9}
                  />
                </mesh>
                {/* U-Slot Index */}
                <Text 
                  position={[-0.022, 0, 0.001]} 
                  fontSize={0.015} 
                  color="#94a3b8"
                  anchorX="center"
                  anchorY="middle"
                >
                  {`${j}`}
                </Text>
                {/* Phase identifier badge */}
                <Text 
                  position={[0.022, 0, 0.001]} 
                  fontSize={0.015} 
                  color={phaseColor}
                  anchorX="center"
                  anchorY="middle"
                  fontWeight="bold"
                >
                  {phase}
                </Text>
                {/* Horizontal partition border lines separating the outlets */}
                <Line
                  points={[[-0.035, U_WORLD / 2, 0.002], [0.035, U_WORLD / 2, 0.002]]}
                  color="#1e293b"
                  lineWidth={1}
                />
              </group>
            )
          }
          return outlets
        }, [])}
      </group>
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
