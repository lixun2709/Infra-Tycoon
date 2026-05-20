/* eslint-disable react-hooks/refs */
import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { InfraNode } from '../../store/infraTypes'
import { useInfraStore } from '../../store/useInfraStore'

interface AirflowVisualizerProps {
  node: InfraNode
  h: number
}

function AirflowVisualizerComponent({ node, h: _h }: AirflowVisualizerProps) {
  const isHeatMapVisible = useInfraStore(s => s.isHeatMapVisible)

  const isRunning = node.systemState === 'running'
  const isCooling = node.type === 'cooling'
  
  const ribbonRef1 = useRef<THREE.Mesh>(null)
  const ribbonRef2 = useRef<THREE.Mesh>(null)
  const ribbonRef3 = useRef<THREE.Mesh>(null)
  const ribbonRef4 = useRef<THREE.Mesh>(null)
  const ribbonRef5 = useRef<THREE.Mesh>(null)

  // 1. Procedural Scrolling Shader Materials
  const coldMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  if (!coldMaterialRef.current) {
    coldMaterialRef.current = new THREE.ShaderMaterial({
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
          float flow = sin((vUv.x - uTime * uSpeed) * uDensity) * 0.5 + 0.5;
          float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(0.0, 0.15, 1.0 - vUv.x);
          float verticalFade = smoothstep(0.0, 0.5, vUv.y) * smoothstep(0.0, 0.5, 1.0 - vUv.y);
          gl_FragColor = vec4(uColor, flow * edgeFade * verticalFade * uOpacity);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uColor: { value: new THREE.Color('#00f2ff') },
        uSpeed: { value: 2.0 },
        uDensity: { value: 12.0 },
        uOpacity: { value: 0.25 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  }
  const coldMaterial = coldMaterialRef.current

  const hotMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  if (!hotMaterialRef.current) {
    hotMaterialRef.current = new THREE.ShaderMaterial({
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
          float flow = sin((vUv.x - uTime * uSpeed) * uDensity) * 0.5 + 0.5;
          float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(0.0, 0.15, 1.0 - vUv.x);
          float verticalFade = smoothstep(0.0, 0.5, vUv.y) * smoothstep(0.0, 0.5, 1.0 - vUv.y);
          gl_FragColor = vec4(uColor, flow * edgeFade * verticalFade * uOpacity);
        }
      `,
      uniforms: {
        uTime: { value: 0.0 },
        uColor: { value: new THREE.Color('#f97316') },
        uSpeed: { value: 2.2 },
        uDensity: { value: 14.0 },
        uOpacity: { value: 0.35 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  }
  const hotMaterial = hotMaterialRef.current

  // 2. Direct GPU Uniform Animation and Dynamic Hardware State Binding
  useFrame(({ clock }) => {
    if (!coldMaterial || !hotMaterial) return

    if (!isRunning) {
      coldMaterial.uniforms.uOpacity!.value = 0.0
      hotMaterial.uniforms.uOpacity!.value = 0.0
      return
    }

    const time = clock.getElapsedTime()
    coldMaterial.uniforms.uTime!.value = time
    hotMaterial.uniforms.uTime!.value = time

    const temp = node.temperature || 25
    
    // Scale visual intensity and opacity when heatmap is active to emphasize NOC digital-twin observability
    const heatmapBoost = isHeatMapVisible ? 1.5 : 1.0

    if (isCooling) {
      // Cooling units push powerful, highly coherent cool air
      coldMaterial.uniforms.uOpacity!.value = 0.45 * heatmapBoost
      coldMaterial.uniforms.uSpeed!.value = 3.5
      coldMaterial.uniforms.uDensity!.value = 10.0
      
      // CRAC return suction
      hotMaterial.uniforms.uOpacity!.value = 0.25 * heatmapBoost
      hotMaterial.uniforms.uSpeed!.value = -2.5 // negative speed pulls air *in*
    } else {
      // Server nodes draw modest cold intake
      coldMaterial.uniforms.uOpacity!.value = 0.18 * heatmapBoost
      coldMaterial.uniforms.uSpeed!.value = 1.5

      // Server hot exhaust adapts dynamically to temperature and silicon stress
      const baseW = 300
      const maxW = 500
      const workload = Math.max(0.0, Math.min(1.0, ((node.wattage || baseW) - baseW) / (maxW - baseW)))

      if (temp > 65) {
        // Red warning exhaust
        hotMaterial.uniforms.uColor!.value.set('#ef4444')
        hotMaterial.uniforms.uSpeed!.value = 3.5 + workload * 1.5
        hotMaterial.uniforms.uDensity!.value = 18.0
        hotMaterial.uniforms.uOpacity!.value = 0.55 * heatmapBoost
      } else if (temp > 45) {
        // Normal warm orange exhaust
        hotMaterial.uniforms.uColor!.value.set('#f97316')
        hotMaterial.uniforms.uSpeed!.value = 2.2 + workload * 0.8
        hotMaterial.uniforms.uDensity!.value = 14.0
        hotMaterial.uniforms.uOpacity!.value = 0.35 * heatmapBoost
      } else {
        // Cool green/yellow low-intensity exhaust
        hotMaterial.uniforms.uColor!.value.set('#84cc16')
        hotMaterial.uniforms.uSpeed!.value = 1.2
        hotMaterial.uniforms.uDensity!.value = 10.0
        hotMaterial.uniforms.uOpacity!.value = 0.20 * heatmapBoost
      }
    }
  })

  if (!isRunning) return null

  // 3. Layout directional flow ribbons
  if (isCooling) {
    return (
      <group>
        {/* CRAC Front Cool Jet Ribbon 1 (Left) */}
        <mesh ref={ribbonRef1} position={[-0.3, 0, 1.05]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 0.04]} />
          <primitive object={coldMaterial} attach="material" />
        </mesh>

        {/* CRAC Front Cool Jet Ribbon 2 (Center) */}
        <mesh ref={ribbonRef2} position={[0.0, 0, 1.05]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 0.04]} />
          <primitive object={coldMaterial} attach="material" />
        </mesh>

        {/* CRAC Front Cool Jet Ribbon 3 (Right) */}
        <mesh ref={ribbonRef3} position={[0.3, 0, 1.05]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 0.04]} />
          <primitive object={coldMaterial} attach="material" />
        </mesh>

        {/* CRAC Back Hot Return Ribbon 1 (Left) */}
        <mesh ref={ribbonRef4} position={[-0.2, 0, -0.85]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.8, 0.03]} />
          <primitive object={hotMaterial} attach="material" />
        </mesh>

        {/* CRAC Back Hot Return Ribbon 2 (Right) */}
        <mesh ref={ribbonRef5} position={[0.2, 0, -0.85]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.8, 0.03]} />
          <primitive object={hotMaterial} attach="material" />
        </mesh>
      </group>
    )
  }

  // Standard Server Directional Flow
  return (
    <group>
      {/* Front Intake Ribbon 1 (Left) */}
      <mesh ref={ribbonRef1} position={[-0.2, 0, 0.675]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.45, 0.012]} />
        <primitive object={coldMaterial} attach="material" />
      </mesh>

      {/* Front Intake Ribbon 2 (Right) */}
      <mesh ref={ribbonRef2} position={[0.2, 0, 0.675]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.45, 0.012]} />
        <primitive object={coldMaterial} attach="material" />
      </mesh>

      {/* Back Exhaust Ribbon 1 (Left) */}
      <mesh ref={ribbonRef3} position={[-0.2, 0, -0.775]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.65, 0.015]} />
        <primitive object={hotMaterial} attach="material" />
      </mesh>

      {/* Back Exhaust Ribbon 2 (Right) */}
      <mesh ref={ribbonRef4} position={[0.2, 0, -0.775]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.65, 0.015]} />
        <primitive object={hotMaterial} attach="material" />
      </mesh>
    </group>
  )
}

export const AirflowVisualizer = React.memo(AirflowVisualizerComponent)
