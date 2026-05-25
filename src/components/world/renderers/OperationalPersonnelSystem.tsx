import React, { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useInfraStore } from '../../../store/useInfraStore'

// --------------------------------------------------------
// Procedural Hierarchical Skeletal Geometries
// --------------------------------------------------------
const headGeo = new THREE.SphereGeometry(0.11, 32, 32)
const neckGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.1, 16)
const chestGeo = new THREE.CapsuleGeometry(0.14, 0.22, 8, 16)
const pelvisGeo = new THREE.CapsuleGeometry(0.12, 0.1, 8, 16)

const upperArmGeo = new THREE.CapsuleGeometry(0.045, 0.18, 8, 16)
const lowerArmGeo = new THREE.CapsuleGeometry(0.04, 0.18, 8, 16)
const thighGeo = new THREE.CapsuleGeometry(0.06, 0.24, 8, 16)
const calfGeo = new THREE.CapsuleGeometry(0.05, 0.24, 8, 16)

const jointGeo = new THREE.SphereGeometry(0.05, 16, 16)
const handGeo = new THREE.SphereGeometry(0.045, 16, 16)
const bootGeo = new THREE.BoxGeometry(0.09, 0.06, 0.15)

const hardhatBaseGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16)
const hardhatDomeGeo = new THREE.SphereGeometry(0.125, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
const visorGeo = new THREE.CapsuleGeometry(0.03, 0.14, 4, 16)
const backpackGeo = new THREE.BoxGeometry(0.2, 0.25, 0.1)

interface PersonnelProps {
  initialPosition: [number, number, number]
  role: 'technician' | 'logistics' | 'security'
  bounds: { minX: number, maxX: number, minZ: number, maxZ: number }
}

function PersonnelActor({ initialPosition, role, bounds }: PersonnelProps) {
  const groupRef = useRef<THREE.Group>(null)
  
  // Skeletal Animation Nodes
  const rootRef = useRef<THREE.Group>(null)
  const chestRef = useRef<THREE.Group>(null)
  
  const lHipRef = useRef<THREE.Group>(null)
  const lKneeRef = useRef<THREE.Group>(null)
  const rHipRef = useRef<THREE.Group>(null)
  const rKneeRef = useRef<THREE.Group>(null)
  
  const lShoulderRef = useRef<THREE.Group>(null)
  const lElbowRef = useRef<THREE.Group>(null)
  const rShoulderRef = useRef<THREE.Group>(null)
  const rElbowRef = useRef<THREE.Group>(null)

  const headGroupRef = useRef<THREE.Group>(null)

  // Wandering State
  // Wandering State
  const [targetPos] = useState(new THREE.Vector3(...initialPosition))
  const [currentPos] = useState(new THREE.Vector3(...initialPosition))
  const [isWalking, setIsWalking] = useState(false)
  const waitTimer = useRef(0)
  
  // Set initial random wait timer on mount only
  React.useEffect(() => {
    waitTimer.current = Math.random() * 5.0
  }, [])

  // High-End Materials
  const materials = useMemo(() => {
    let mainColor, vestColor, hatColor, visorColor
    
    switch (role) {
      case 'technician': 
        mainColor = '#0f172a'
        vestColor = '#eab308' // High-vis yellow
        hatColor = '#ffffff'
        visorColor = '#38bdf8' 
        break
      case 'logistics': 
        mainColor = '#1e293b'
        vestColor = '#475569'
        hatColor = '#f97316'
        visorColor = '#f97316'
        break
      case 'security': 
        mainColor = '#020617'
        vestColor = '#0f172a'
        hatColor = '#020617'
        visorColor = '#ef4444'
        break
    }

    return {
      suitMat: new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.8, metalness: 0.1 }),
      vestMat: new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.6, metalness: 0.2 }),
      helmetMat: new THREE.MeshPhysicalMaterial({ color: hatColor, roughness: 0.1, metalness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.1 }),
      visorMat: new THREE.MeshStandardMaterial({ color: '#000000', emissive: visorColor, emissiveIntensity: 2.0, roughness: 0.1 }),
      bootMat: new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.9 }),
      jointMat: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }), // Dark joints like an undersuit
      skinMat: new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5 }) 
    }
  }, [role])

  // Full Hierarchical Kinematic Walk Cycle
  useFrame((state, delta) => {
    if (!groupRef.current) return

    const distanceToTarget = currentPos.distanceTo(targetPos)
    
    if (distanceToTarget < 0.1) {
      setIsWalking(false)
      waitTimer.current -= delta
      
      if (waitTimer.current <= 0) {
        const nx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX)
        const nz = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        targetPos.set(nx, currentPos.y, nz)
        waitTimer.current = 4.0 + Math.random() * 10.0 
        setIsWalking(true)
      }
    } else {
      const speed = 1.0 * delta
      const direction = new THREE.Vector3().subVectors(targetPos, currentPos).normalize()
      currentPos.addScaledVector(direction, speed)
      
      const targetAngle = Math.atan2(direction.x, direction.z)
      const currentAngle = groupRef.current.rotation.y
      
      let diff = targetAngle - currentAngle
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      
      groupRef.current.rotation.y += diff * 4.0 * delta
    }

    groupRef.current.position.copy(currentPos)

    // Forward Kinematics Animation
    const t = state.clock.getElapsedTime()
      
      if (chestRef.current) {
        chestRef.current.rotation.z = Math.sin(t * 6.0) * 0.05 // Sway
        chestRef.current.rotation.y = Math.sin(t * 6.0) * 0.1  // Twist
      }

      // Legs (Thigh swings forward/back, Knee bends backwards)
      if (isWalking) {
      const w = t * 6.0 // walk speed
      
      // Root Bobbing
      if (rootRef.current) rootRef.current.position.y = Math.abs(Math.sin(w)) * 0.05

      // Legs (Thigh swings forward/back, Knee bends backwards)
      if (lHipRef.current) lHipRef.current.rotation.x = Math.sin(w) * 0.6
      if (rHipRef.current) rHipRef.current.rotation.x = Math.sin(w + Math.PI) * 0.6
      
      // Knees only bend back (positive rotation in this setup)
      if (lKneeRef.current) lKneeRef.current.rotation.x = Math.max(0, Math.sin(w + Math.PI / 2) * 0.8)
      if (rKneeRef.current) rKneeRef.current.rotation.x = Math.max(0, Math.sin(w - Math.PI / 2) * 0.8)

      // Arms (Shoulder swings opposite to legs, Elbows bend slightly)
      if (lShoulderRef.current) lShoulderRef.current.rotation.x = Math.sin(w + Math.PI) * 0.5
      if (rShoulderRef.current) rShoulderRef.current.rotation.x = Math.sin(w) * 0.5

      if (lElbowRef.current) lElbowRef.current.rotation.x = -0.2 + Math.sin(w + Math.PI) * 0.2
      if (rElbowRef.current) rElbowRef.current.rotation.x = -0.2 + Math.sin(w) * 0.2

      // Head looks around slightly while walking
      if (headGroupRef.current) headGroupRef.current.rotation.y = Math.sin(t * 1.5) * 0.2
      
    } else {
      // Idle Animation
      if (rootRef.current) rootRef.current.position.y = Math.sin(t * 1.5) * 0.015 // Breathing
      if (chestRef.current) {
        chestRef.current.rotation.z = 0
        chestRef.current.rotation.y = 0
      }

      // Reset legs
      if (lHipRef.current) lHipRef.current.rotation.x = 0
      if (rHipRef.current) rHipRef.current.rotation.x = 0
      if (lKneeRef.current) lKneeRef.current.rotation.x = 0
      if (rKneeRef.current) rKneeRef.current.rotation.x = 0

      // Head looking
      if (headGroupRef.current) headGroupRef.current.rotation.y = Math.sin(t * 0.8) * 0.3

      if (role === 'technician') {
        // Holding tablet
        if (lShoulderRef.current) lShoulderRef.current.rotation.x = -Math.PI / 2.5
        if (rShoulderRef.current) rShoulderRef.current.rotation.x = -Math.PI / 2.5
        if (lElbowRef.current) lElbowRef.current.rotation.x = -0.5
        if (rElbowRef.current) rElbowRef.current.rotation.x = -0.5
      } else if (role === 'security') {
        // Hands behind back
        if (lShoulderRef.current) lShoulderRef.current.rotation.x = Math.PI / 6
        if (rShoulderRef.current) rShoulderRef.current.rotation.x = Math.PI / 6
        if (lElbowRef.current) lElbowRef.current.rotation.x = -Math.PI / 4
        if (rElbowRef.current) rElbowRef.current.rotation.x = -Math.PI / 4
      } else {
        // Relaxed idle
        if (lShoulderRef.current) lShoulderRef.current.rotation.x = Math.sin(t * 1.5) * 0.05
        if (rShoulderRef.current) rShoulderRef.current.rotation.x = Math.sin(t * 1.5 + 0.5) * 0.05
        if (lElbowRef.current) lElbowRef.current.rotation.x = -0.1
        if (rElbowRef.current) rElbowRef.current.rotation.x = -0.1
      }
    }
  })

  // Vertical offsets based on capsule lengths
  const bootY = 0.03
  const calfLen = 0.24
  const thighLen = 0.24
  const pelvisY = bootY + calfLen + thighLen // ~0.51
  
  const chestLen = 0.22
  
  const uArmLen = 0.18
  const lArmLen = 0.18

  return (
    <group ref={groupRef}>
      {/* ROOT NODE (Animates up and down) */}
      <group ref={rootRef}>
        
        {/* PELVIS */}
        <mesh geometry={pelvisGeo} material={materials.suitMat} position={[0, pelvisY, 0]} castShadow>
          
          {/* CHEST (Child of Pelvis) */}
          <group ref={chestRef} position={[0, 0.12, 0]}>
            <mesh geometry={chestGeo} material={materials.vestMat} position={[0, chestLen/2, 0]} castShadow>
              {/* Reflective safety strip */}
              {role !== 'security' && (
                <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.145, 0.145, 0.06, 16, 1, true, 0, Math.PI]} />
                  <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} side={THREE.DoubleSide} />
                </mesh>
              )}
            </mesh>

            {/* NECK -> HEAD */}
            <group position={[0, chestLen + 0.05, 0]}>
              <mesh geometry={neckGeo} material={materials.skinMat} position={[0, 0, 0]} castShadow />
              <group ref={headGroupRef} position={[0, 0.08, 0]}>
                <mesh geometry={headGeo} material={materials.skinMat} castShadow />
                <mesh geometry={visorGeo} material={materials.visorMat} position={[0, 0, 0.09]} rotation={[0, 0, Math.PI / 2]} />
                {role !== 'security' && (
                  <group position={[0, 0.03, 0]}>
                    <mesh geometry={hardhatBaseGeo} material={materials.helmetMat} castShadow />
                    <mesh geometry={hardhatDomeGeo} material={materials.helmetMat} position={[0, 0.02, 0]} castShadow />
                  </group>
                )}
              </group>
            </group>

            {/* BACKPACK */}
            {role !== 'security' && (
              <mesh geometry={backpackGeo} material={materials.suitMat} position={[0, chestLen/2, -0.15]} castShadow>
                <mesh position={[0, 0.08, -0.05]}>
                  <boxGeometry args={[0.08, 0.04, 0.02]} />
                  <meshStandardMaterial emissive="#10b981" emissiveIntensity={2} color="#000000" />
                </mesh>
              </mesh>
            )}

            {/* LEFT SHOULDER -> ARM */}
            <group position={[-0.18, chestLen - 0.02, 0]}>
              <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
              <group ref={lShoulderRef}>
                <mesh geometry={upperArmGeo} material={materials.suitMat} position={[0, -uArmLen/2, 0]} castShadow />
                <group position={[0, -uArmLen, 0]}>
                  <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
                  <group ref={lElbowRef}>
                    <mesh geometry={lowerArmGeo} material={materials.suitMat} position={[0, -lArmLen/2, 0]} castShadow />
                    <mesh geometry={handGeo} material={materials.skinMat} position={[0, -lArmLen, 0]} castShadow />
                  </group>
                </group>
              </group>
            </group>

            {/* RIGHT SHOULDER -> ARM */}
            <group position={[0.18, chestLen - 0.02, 0]}>
              <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
              <group ref={rShoulderRef}>
                <mesh geometry={upperArmGeo} material={materials.suitMat} position={[0, -uArmLen/2, 0]} castShadow />
                <group position={[0, -uArmLen, 0]}>
                  <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
                  <group ref={rElbowRef}>
                    <mesh geometry={lowerArmGeo} material={materials.suitMat} position={[0, -lArmLen/2, 0]} castShadow />
                    <mesh geometry={handGeo} material={materials.skinMat} position={[0, -lArmLen, 0]} castShadow />
                  </group>
                </group>
              </group>
            </group>

            {/* TABLET (Only visible in idle for tech) */}
            {role === 'technician' && !isWalking && (
              <group position={[0, 0, 0.35]} rotation={[-Math.PI / 3, 0, 0]}>
                <mesh>
                  <boxGeometry args={[0.25, 0.18, 0.015]} />
                  <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.8} />
                </mesh>
                <mesh position={[0, 0, 0.05]}>
                  <planeGeometry args={[0.2, 0.12]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
              </group>
            )}

          </group>
        </mesh>

        {/* LEFT HIP -> LEG */}
        <group position={[-0.09, pelvisY, 0]}>
          <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
          <group ref={lHipRef}>
            <mesh geometry={thighGeo} material={materials.suitMat} position={[0, -thighLen/2, 0]} castShadow />
            <group position={[0, -thighLen, 0]}>
              <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
              <group ref={lKneeRef}>
                <mesh geometry={calfGeo} material={materials.suitMat} position={[0, -calfLen/2, 0]} castShadow />
                <mesh geometry={bootGeo} material={materials.bootMat} position={[0, -calfLen, 0.02]} castShadow />
              </group>
            </group>
          </group>
        </group>

        {/* RIGHT HIP -> LEG */}
        <group position={[0.09, pelvisY, 0]}>
          <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
          <group ref={rHipRef}>
            <mesh geometry={thighGeo} material={materials.suitMat} position={[0, -thighLen/2, 0]} castShadow />
            <group position={[0, -thighLen, 0]}>
              <mesh geometry={jointGeo} material={materials.jointMat} castShadow />
              <group ref={rKneeRef}>
                <mesh geometry={calfGeo} material={materials.suitMat} position={[0, -calfLen/2, 0]} castShadow />
                <mesh geometry={bootGeo} material={materials.bootMat} position={[0, -calfLen, 0.02]} castShadow />
              </group>
            </group>
          </group>
        </group>

      </group>
    </group>
  )
}

export function OperationalPersonnelSystem() {
  const { halls } = useInfraStore()

  const personnel = useMemo(() => {
    const list = []
    
    halls.forEach((hall) => {
      const hx = hall.x * 30
      const hz = hall.z * 30
      const bounds = { minX: hx - 12, maxX: hx + 12, minZ: hz - 12, maxZ: hz + 12 }

      list.push({ id: `tech-${hall.id}-1`, role: 'technician' as const, pos: [hx - 5, 1.6, hz + 5] as [number, number, number], bounds })
      list.push({ id: `tech-${hall.id}-2`, role: 'technician' as const, pos: [hx + 5, 1.6, hz - 5] as [number, number, number], bounds })
    })

    list.push({ id: 'log-1', role: 'logistics' as const, pos: [-38, 0, -38] as [number, number, number], bounds: { minX: -45, maxX: -30, minZ: -45, maxZ: -30 } })
    list.push({ id: 'log-2', role: 'logistics' as const, pos: [38, 0, 38] as [number, number, number], bounds: { minX: 30, maxX: 45, minZ: 30, maxZ: 45 } })
    list.push({ id: 'sec-1', role: 'security' as const, pos: [40, 0, 0] as [number, number, number], bounds: { minX: 35, maxX: 45, minZ: -10, maxZ: 10 } })

    return list
  }, [halls])

  return (
    <group>
      {personnel.map(p => (
        <PersonnelActor key={p.id} initialPosition={p.pos} role={p.role} bounds={p.bounds} />
      ))}
    </group>
  )
}
