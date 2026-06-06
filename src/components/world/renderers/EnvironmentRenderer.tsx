import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Text, Environment } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { audioManager } from '../../../utils/AudioManager'

// --- 1. COMPUTER ROOM AIR HANDLER (CRAH) CABINET ---
function CRAHUnit({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const fanRef1 = useRef<THREE.Group>(null)
  const fanRef2 = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const focusOnPosition = useInfraStore(s => s.focusOnPosition)

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 12
    if (fanRef1.current) fanRef1.current.rotation.z = t
    if (fanRef2.current) fanRef2.current.rotation.z = -t
  })

  return (
    <group 
      position={position} 
      rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        audioManager.playEffect('click')
        focusOnPosition({ x: position[0], y: position[1] + 1.6, z: position[2] })
      }}
    >
      {/* Floating Name Tag */}
      <Text 
        position={[0, 1.5, 0]} 
        fontSize={0.14} 
        color={hovered ? '#00f2ff' : '#ffffff'} 
        outlineColor="#09090b" 
        outlineWidth={0.015}
        anchorX="center"
        anchorY="middle"
      >
        CRAH COOLING UNIT
      </Text>

      {/* Heavy Steel Cabinet Enclosure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.8, 2.4, 1.2]} />
        <meshStandardMaterial 
          color="#0284c7" 
          roughness={0.25} 
          metalness={0.7} 
          emissive={hovered ? '#0ea5e9' : '#000000'}
          emissiveIntensity={hovered ? 0.15 : 0}
        />
      </mesh>

      {/* Control Display LCD Panel */}
      <mesh position={[0.45, 0.7, 0.61]}>
        <planeGeometry args={[0.5, 0.25]} />
        <meshStandardMaterial color="#020617" emissive="#0ea5e9" emissiveIntensity={1.2} />
      </mesh>

      {/* Telemetry Indicator LED Grids */}
      <mesh position={[-0.45, 0.7, 0.61]}>
        <planeGeometry args={[0.35, 0.06]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.5} />
      </mesh>

      {/* Ventilation Intake Grille */}
      <mesh position={[0, -0.4, 0.601]}>
        <planeGeometry args={[1.5, 1.2]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>

      {/* Left Cooling Fan Grille */}
      <group position={[-0.35, -0.4, 0.61]}>
        <mesh>
          <torusGeometry args={[0.24, 0.015, 8, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <group ref={fanRef1}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <planeGeometry args={[0.06, 0.44]} />
              <meshStandardMaterial color="#64748b" side={THREE.DoubleSide} metalness={0.8} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Right Cooling Fan Grille */}
      <group position={[0.35, -0.4, 0.61]}>
        <mesh>
          <torusGeometry args={[0.24, 0.015, 8, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <group ref={fanRef2}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <planeGeometry args={[0.06, 0.44]} />
              <meshStandardMaterial color="#64748b" side={THREE.DoubleSide} metalness={0.8} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

// --- 2. UNINTERRUPTIBLE POWER SUPPLY (UPS) CABINET ---
function UPSCabinet({ position }: { position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false)
  const focusOnPosition = useInfraStore(s => s.focusOnPosition)

  return (
    <group 
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        audioManager.playEffect('click')
        focusOnPosition({ x: position[0], y: position[1] + 1.6, z: position[2] })
      }}
    >
      {/* Floating Name Tag */}
      <Text 
        position={[0, 1.35, 0]} 
        fontSize={0.14} 
        color={hovered ? '#fde047' : '#ffffff'} 
        outlineColor="#09090b" 
        outlineWidth={0.015}
        anchorX="center"
        anchorY="middle"
      >
        UPS BATTERY UNIT
      </Text>

      {/* UPS Metal Enclosure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.1, 2.1, 0.9]} />
        <meshStandardMaterial 
          color="#d97706" 
          metalness={0.7} 
          roughness={0.2} 
          emissive={hovered ? '#f59e0b' : '#000000'}
          emissiveIntensity={hovered ? 0.15 : 0}
        />
      </mesh>

      {/* Charging Indicator Light Bars */}
      {[-0.3, 0, 0.3].map((yOffset, i) => (
        <mesh key={i} position={[0, 0.4 + yOffset * 0.4, 0.46]}>
          <planeGeometry args={[0.6, 0.08]} />
          <meshStandardMaterial 
            color={i === 2 ? '#fde047' : '#10b981'} 
            emissive={i === 2 ? '#fde047' : '#10b981'} 
            emissiveIntensity={1.2} 
          />
        </mesh>
      ))}

      {/* Main Digital Load Display */}
      <mesh position={[0, 0.8, 0.46]}>
        <planeGeometry args={[0.5, 0.16]} />
        <meshStandardMaterial color="#020617" emissive="#10b981" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

// --- 5.5 BACKGROUND CLUTTER COMPONENTS ---
function PalletStack({ position, rotation = [0,0,0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Wooden Pallet */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.15, 1.2]} />
        <meshStandardMaterial color="#854d0e" roughness={0.9} />
      </mesh>
      {/* Server Boxes */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.8, 1.1]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.4, 1.1]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} />
      </mesh>
    </group>
  )
}

function MaintenanceCart({ position, rotation = [0,0,0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.6, 0.8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Wheels */}
      {[-0.6, 0.6].map(x => [-0.3, 0.3].map(z => (
        <mesh key={`${x}-${z}`} position={[x, 0.1, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      )))}
    </group>
  )
}



// --- 6. LOAD-BEARING STRUCTURAL H-BEAM COMPONENT ---
function StructuralPillar({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <group position={position}>
      {/* Heavy Base Steel Plate */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
      </mesh>
      
      {/* Base Bolts */}
      {[-0.3, 0.3].map((x) => 
        [-0.3, 0.3].map((z) => (
          <mesh key={`bolt-${x}-${z}`} position={[x, 0.12, z]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.08, 6]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
        ))
      )}

      {/* H-Beam Flanges */}
      <mesh position={[0, height / 2, 0.25]} castShadow receiveShadow>
        <boxGeometry args={[0.6, height, 0.1]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh position={[0, height / 2, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[0.6, height, 0.1]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* H-Beam Web */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.1, height, 0.4]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
      </mesh>

      {/* Cross-Bracing Support Brackets at mid-height (example) */}
      {height > 5 && (
        <group position={[0, height * 0.5, 0]}>
          <mesh position={[0.35, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.1, 0.4, 0.3]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
          </mesh>
          <mesh position={[-0.35, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.1, 0.4, 0.3]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
          </mesh>
        </group>
      )}

      {/* Heavy Cap Steel Plate */}
      <mesh position={[0, height - 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.6} />
      </mesh>
    </group>
  )
}

// --- 7. ELEVATED PLATFORM FRAME & SAFETY RAILINGS COMPONENT ---
interface PlatformEdgeProps {
  hallX: number
  hallZ: number
  hasN: boolean
  hasS: boolean
  hasW: boolean
  hasE: boolean
}

function PlatformEdges({ hallX, hallZ, hasN, hasS, hasW, hasE }: PlatformEdgeProps) {
  const hx = hallX * 30
  const hz = hallZ * 30
  const beamY = 1.45 // Y level of edge channel beam

  return (
    <group position={[hx, 0, hz]}>
      {/* NORTH EDGE */}
      {!hasN && (
        <group position={[0, 0, -15.15]}>
          {/* Steel edge channel beam */}
          <mesh position={[0, beamY, 0]} castShadow receiveShadow>
            <boxGeometry args={[30.0, 0.3, 0.2]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Yellow/Black hazard warning borders */}
          {[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((xOffset) => (
            <mesh key={xOffset} position={[xOffset, beamY, 0.101]}>
              <planeGeometry args={[1.5, 0.2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          ))}
          {/* Railing Posts (spaced every 2.5m) */}
          {[-15.0, -12.5, -10.0, -7.5, -5.0, -2.5, 0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0].map((xOffset) => (
            <group key={xOffset} position={[xOffset, 1.6, 0]}>
              {/* Railing post */}
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[0.06, 1.1, 0.06]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
              </mesh>
              {/* Toe-board Kickplate (spans between posts) */}
              {xOffset < 15.0 && (
                <mesh position={[1.25, 0.05, 0.02]} castShadow>
                  <boxGeometry args={[2.5, 0.1, 0.02]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
              )}
            </group>
          ))}
          {/* Horizontal Top handrail */}
          <mesh position={[0, 2.7, 0]} castShadow>
            <boxGeometry args={[30.0, 0.04, 0.04]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Horizontal Mid rail */}
          <mesh position={[0, 2.15, 0]} castShadow>
            <boxGeometry args={[30.0, 0.03, 0.03]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Structural support legs on hangar floor (every 6m) */}
          {[-12, -6, 0, 6, 12].map((xOffset) => (
            <group key={xOffset} position={[xOffset, 0, 0]}>
              <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 1.3, 0.25]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.075, 0]} castShadow>
                <boxGeometry args={[0.35, 0.15, 0.35]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* SOUTH EDGE */}
      {!hasS && (
        <group position={[0, 0, 15.15]}>
          {/* Steel edge channel beam */}
          <mesh position={[0, beamY, 0]} castShadow receiveShadow>
            <boxGeometry args={[30.0, 0.3, 0.2]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Yellow/Black hazard warning borders */}
          {[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((xOffset) => (
            <mesh key={xOffset} position={[xOffset, beamY, -0.101]}>
              <planeGeometry args={[1.5, 0.2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          ))}
          {/* Railing Posts */}
          {[-15.0, -12.5, -10.0, -7.5, -5.0, -2.5, 0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0].map((xOffset) => (
            <group key={xOffset} position={[xOffset, 1.6, 0]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[0.06, 1.1, 0.06]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
              </mesh>
              {xOffset < 15.0 && (
                <mesh position={[1.25, 0.05, -0.02]} castShadow>
                  <boxGeometry args={[2.5, 0.1, 0.02]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
              )}
            </group>
          ))}
          <mesh position={[0, 2.7, 0]} castShadow>
            <boxGeometry args={[30.0, 0.04, 0.04]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <boxGeometry args={[30.0, 0.03, 0.03]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Support legs */}
          {[-12, -6, 0, 6, 12].map((xOffset) => (
            <group key={xOffset} position={[xOffset, 0, 0]}>
              <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 1.3, 0.25]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.075, 0]} castShadow>
                <boxGeometry args={[0.35, 0.15, 0.35]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* WEST EDGE */}
      {!hasW && (
        <group position={[-15.15, 0, 0]}>
          {/* Steel edge channel beam */}
          <mesh position={[0, beamY, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.3, 30.0]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Yellow/Black hazard warning borders */}
          {[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((zOffset) => (
            <mesh key={zOffset} position={[0.101, beamY, zOffset]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.5, 0.2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          ))}
          {/* Railing Posts */}
          {[-15.0, -12.5, -10.0, -7.5, -5.0, -2.5, 0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0].map((zOffset) => (
            <group key={zOffset} position={[0, 1.6, zOffset]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[0.06, 1.1, 0.06]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
              </mesh>
              {zOffset < 15.0 && (
                <mesh position={[0.02, 0.05, 1.25]} castShadow>
                  <boxGeometry args={[0.02, 0.1, 2.5]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
              )}
            </group>
          ))}
          <mesh position={[0, 2.7, 0]} castShadow>
            <boxGeometry args={[0.04, 0.04, 30.0]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <boxGeometry args={[0.03, 0.03, 30.0]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Support legs */}
          {[-12, -6, 0, 6, 12].map((zOffset) => (
            <group key={zOffset} position={[0, 0, zOffset]}>
              <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 1.3, 0.25]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.075, 0]} castShadow>
                <boxGeometry args={[0.35, 0.15, 0.35]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* EAST EDGE */}
      {!hasE && (
        <group position={[15.15, 0, 0]}>
          {/* Steel edge channel beam */}
          <mesh position={[0, beamY, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.3, 30.0]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Yellow/Black hazard warning borders */}
          {[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((zOffset) => (
            <mesh key={zOffset} position={[-0.101, beamY, zOffset]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[1.5, 0.2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          ))}
          {/* Railing Posts */}
          {[-15.0, -12.5, -10.0, -7.5, -5.0, -2.5, 0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0].map((zOffset) => (
            <group key={zOffset} position={[0, 1.6, zOffset]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[0.06, 1.1, 0.06]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
              </mesh>
              {zOffset < 15.0 && (
                <mesh position={[-0.02, 0.05, 1.25]} castShadow>
                  <boxGeometry args={[0.02, 0.1, 2.5]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
              )}
            </group>
          ))}
          <mesh position={[0, 2.7, 0]} castShadow>
            <boxGeometry args={[0.04, 0.04, 30.0]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <boxGeometry args={[0.03, 0.03, 30.0]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Support legs */}
          {[-12, -6, 0, 6, 12].map((zOffset) => (
            <group key={zOffset} position={[0, 0, zOffset]}>
              <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.25, 1.3, 0.25]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.075, 0]} castShadow>
                <boxGeometry args={[0.35, 0.15, 0.35]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

// --- 8. INDUSTRIAL STAIRCASE COMPONENT (Connects Hangar Floor to Raised Room Platform) ---
function PlatformStairs({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const steps = 10
  const stepW = 1.4
  const stepH = 1.6 / steps // 0.16
  const stepD = 2.0 / steps // 0.20

  return (
    <group position={position} rotation={rotation}>
      {/* Structural Steel Stringers (sides) */}
      <mesh position={[-stepW / 2 - 0.05, 0.8, 1.0]} rotation={[0.67, 0, 0]} castShadow>
        <boxGeometry args={[0.05, 0.16, 2.6]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[stepW / 2 + 0.05, 0.8, 1.0]} rotation={[0.67, 0, 0]} castShadow>
        <boxGeometry args={[0.05, 0.16, 2.6]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Individual Step Treads */}
      {[...Array(steps)].map((_, idx) => {
        const sy = (idx + 0.5) * stepH
        const sz = (steps - idx - 0.5) * stepD
        return (
          <mesh key={idx} position={[0, sy, sz]} castShadow receiveShadow>
            <boxGeometry args={[stepW, 0.03, 0.28]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
        )
      })}

      {/* Yellow Safety Handrail Left */}
      <group position={[-stepW / 2 - 0.06, 0, 0]}>
        {/* Support Post Low */}
        <mesh position={[0, 0.45 + stepH * 2, 1.6]} castShadow>
          <boxGeometry args={[0.04, 0.9, 0.04]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
        {/* Support Post High */}
        <mesh position={[0, 1.25 + stepH * 2, 0.4]} castShadow>
          <boxGeometry args={[0.04, 0.9, 0.04]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
        {/* Sloped Handrail Bar */}
        <mesh position={[0, 0.85 + stepH * 2, 1.0]} rotation={[0.67, 0, 0]} castShadow>
          <boxGeometry args={[0.03, 0.03, 2.6]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
      </group>

      {/* Yellow Safety Handrail Right */}
      <group position={[stepW / 2 + 0.06, 0, 0]}>
        {/* Support Post Low */}
        <mesh position={[0, 0.45 + stepH * 2, 1.6]} castShadow>
          <boxGeometry args={[0.04, 0.9, 0.04]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
        {/* Support Post High */}
        <mesh position={[0, 1.25 + stepH * 2, 0.4]} castShadow>
          <boxGeometry args={[0.04, 0.9, 0.04]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
        {/* Sloped Handrail Bar */}
        <mesh position={[0, 0.85 + stepH * 2, 1.0]} rotation={[0.67, 0, 0]} castShadow>
          <boxGeometry args={[0.03, 0.03, 2.6]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
      </group>
    </group>
  )
}

// --- MAIN ENVIRONMENT RENDERER COMPONENT ---
export function EnvironmentRenderer() {
  const { totalRoomBTU, halls } = useInfraStore(useShallow(state => ({
    totalRoomBTU: state.totalRoomBTU,
    halls: state.halls
  })))
  const isHot = totalRoomBTU > 50000

  const CEILING_Y = 5.5

  const hallRows = [
    { id: 'row-1', zOffset: -6, aisleType: 'cold' as const },
    { id: 'row-2', zOffset: -2, aisleType: 'hot' as const },
    { id: 'row-3', zOffset: 2, aisleType: 'cold' as const },
    { id: 'row-4', zOffset: 6, aisleType: 'hot' as const }
  ]

  const boundaryCoords = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]

  // 1. Polished Epoxy Concrete Floor Canvas Texture
  const groundTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Base light concrete warehouse ground color
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(0, 0, 1024, 1024)

    // Concrete Slab joints ( expansion cuts )
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 4
    for (let x = 0; x <= 1024; x += 128) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 1024)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, x)
      ctx.lineTo(1024, x)
      ctx.stroke()
    }

    // Specular concrete joint bevel lines
    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1.5
    for (let x = 2; x <= 1024; x += 128) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 1024)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, x)
      ctx.lineTo(1024, x)
      ctx.stroke()
    }

    // Pure Seeded PRNG for idempotent rendering
    let seed = 42
    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000
      return x - Math.floor(x)
    }

    // Concrete grain and micro-wear noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
    for (let i = 0; i < 9000; i++) {
      const rx = pseudoRandom() * 1024
      const ry = pseudoRandom() * 1024
      ctx.fillRect(rx, ry, 1.5, 1.5)
    }

    // Wide Yellow Safety Traffic Lanes
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)'
    ctx.lineWidth = 8
    ctx.setLineDash([20, 15])
    
    // Draw outer traffic loop around platform grid
    ctx.strokeRect(200, 200, 624, 624)
    ctx.strokeRect(100, 100, 824, 824)

    // Draw loading zone caution stripes
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(234, 179, 8, 0.08)'
    ctx.fillRect(200, 200, 120, 120)
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)'
    ctx.lineWidth = 5
    for (let offset = 0; offset <= 240; offset += 20) {
      ctx.beginPath()
      ctx.moveTo(200 + offset, 200)
      ctx.lineTo(200, 200 + offset)
      ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    tex.anisotropy = 16
    return tex
  }, [])

  return (
    <>
      {/* 1. Muted Moody Industrial Hangar Atmosphere */}
      <color attach="background" args={isHot ? ['#0d0404'] : ['#05080e']} />
      <fogExp2 attach="fog" args={[isHot ? '#0d0404' : '#05080e', 0.0035]} />
      
      {/* Increased general ambient to brighten the shadows */}
      <ambientLight intensity={1.0} color={isHot ? '#fecaca' : '#aec5eb'} />
      
      {/* Soft sun fill light */}
      <directionalLight 
        position={[35, 50, 25]} 
        intensity={1.5} 
        color={isHot ? '#fca5a5' : '#e2e8f0'} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Environment preset="city" environmentIntensity={0.8} />

      {/* Intense Core Datacenter Spotlights */}
      <spotLight 
        position={[0, 20, 0]} 
        angle={Math.PI / 3} 
        penumbra={0.8} 
        intensity={1000} 
        distance={50} 
        color={isHot ? '#ff7a7a' : '#e0f2fe'} 
        castShadow 
        decay={1.5}
      />

      {/* Volumetric Distant Hangar ceiling fixture point lights */}
      <pointLight position={[-45, 12, -45]} intensity={7.0} distance={50} color="#ea580c" decay={2} />
      <pointLight position={[45, 12, 45]} intensity={7.0} distance={50} color="#ea580c" decay={2} />
      <pointLight position={[-45, 12, 45]} intensity={7.0} distance={50} color="#ea580c" decay={2} />
      <pointLight position={[45, 12, -45]} intensity={7.0} distance={50} color="#ea580c" decay={2} />

      {/* 12 Pendant High-Bay Lamps with soft translucent Volumetric light cones */}
      {useMemo(() => {
        const lamps = []
        const coordsX = [-45, 0, 45]
        const coordsZ = [-45, -15, 15, 45]
        for (const x of coordsX) {
          for (const z of coordsZ) {
            lamps.push({ x, z })
          }
        }
        return lamps
      }, []).map((lamp, idx) => (
        <group key={`lamp-${idx}`} position={[lamp.x, 15.6, lamp.z]}>
          {/* Hanger Cable */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Reflector Shade */}
          <mesh castShadow position={[0, 0, 0]}>
            <coneGeometry args={[0.5, 0.6, 16, 1, true]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          {/* Glowing bulb */}
          <mesh position={[0, -0.15, 0]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#ffffff" emissive="#f97316" emissiveIntensity={3.0} />
          </mesh>
          {/* Volumetric spotlight cone */}
          <mesh position={[0, -7.0, 0]}>
            <coneGeometry args={[4.2, 14.0, 16, 1, true]} />
            <meshBasicMaterial 
              color="#f97316" 
              transparent 
              opacity={0.02} 
              depthWrite={false} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        </group>
      ))}

      {/* 2. Shiny Polished Concrete Epoxy Hangar Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial 
          color="#f8fafc"
          map={groundTexture || undefined}
          roughness={0.18} 
          metalness={0.65} 
        />
      </mesh>

      {/* 3. Massive Enclosing Background Structural Shell */}
      {/* concrete outer walls */}
      <mesh position={[0, 8.0, -75.0]}>
        <boxGeometry args={[150, 16, 0.5]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 8.0, 75.0]}>
        <boxGeometry args={[150, 16, 0.5]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      <mesh position={[-75.0, 8.0, 0]}>
        <boxGeometry args={[0.5, 16, 150]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      <mesh position={[75.0, 8.0, 0]}>
        <boxGeometry args={[0.5, 16, 150]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      {/* Distant Cargo Shutter Doors */}
      {[-45, -15, 15, 45].map((xOffset) => (
        <group key={xOffset}>
          <mesh position={[xOffset, 2.5, -74.7]}>
            <boxGeometry args={[6.0, 5.0, 0.1]} />
            <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[xOffset, 2.5, 74.7]}>
            <boxGeometry args={[6.0, 5.0, 0.1]} />
            <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Massive structural hangar columns with high-visibility yellow feet */}
      {[-45, -15, 15, 45].map((wX) =>
        [-45, -15, 15, 45].map((wZ) => {
          // Omit columns if they fall inside active room campus
          const isNearRoom = halls.some((h: any) => Math.abs(h.x * 30 - wX) < 25 && Math.abs(h.z * 30 - wZ) < 25)
          if (isNearRoom) return null

          return (
            <group key={`w-col-${wX}-${wZ}`}>
              <mesh position={[wX, 8.0, wZ]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 16, 1.0]} />
                <meshStandardMaterial color="#2d3748" roughness={0.4} metalness={0.7} />
              </mesh>
              {/* High-visibility yellow safety guards at the floor base (y=0 to y=2) */}
              <mesh position={[wX, 1.0, wZ]} castShadow>
                <boxGeometry args={[1.7, 2.0, 1.2]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} />
              </mesh>
              {/* Ceiling truss connection */}
              <mesh position={[wX, 16.0, wZ]} rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.2, 30, 0.2]} />
                <meshStandardMaterial color="#334155" metalness={0.7} />
              </mesh>
            </group>
          )
        })
      )}

      {/* Horizontal Steel Double-Girders & Cross Trusses overhead */}
      {[-45, -15, 15, 45].map((coord, idx) => (
        <group key={`truss-group-${idx}`}>
          {/* Spanning Z */}
          <mesh position={[coord, 15.8, 0]}>
            <boxGeometry args={[0.4, 0.4, 150.0]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Spanning X */}
          <mesh position={[0, 15.8, coord]}>
            <boxGeometry args={[150.0, 0.4, 0.4]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Horizontal Silver HVAC Ventilation Ducts running along margins */}
      {[-74.0, 74.0].map((zPos) => (
        <group key={zPos} position={[0, 11.0, zPos]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.6, 0.6, 148.0, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Duct hanger brackets every 20m */}
          {[-60, -40, -20, 0, 20, 40, 60].map((xOffset) => (
            <group key={xOffset} position={[xOffset, 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.65, 0.65, 0.4, 16]} />
                <meshStandardMaterial color="#475569" metalness={0.8} />
              </mesh>
              <mesh position={[0, 2.4, 0]}>
                <boxGeometry args={[0.08, 4.8, 0.62]} />
                <meshStandardMaterial color="#334155" metalness={0.8} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* 4. Dynamic Orange CapEx Blueprint Grid Outlines */}
      {(() => {
        const slots: { tx: number; tz: number }[] = []
        for (let tx = -2; tx <= 2; tx++) {
          for (let tz = -2; tz <= 2; tz++) {
            const occupied = halls.some((h: any) => h.x === tx && h.z === tz)
            if (!occupied) {
              const adjacent = halls.some((h: any) => Math.abs(h.x - tx) + Math.abs(h.z - tz) === 1)
              if (adjacent) {
                slots.push({ tx, tz })
              }
            }
          }
        }

        return slots.map(({ tx, tz }) => (
          <group key={`exp-grid-${tx}-${tz}`} position={[tx * 30, 0.015, tz * 30]}>
            {/* Neon Orange Dashed Grid Outline Square */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[21.05, 21.21, 4, 1, Math.PI / 4]} />
              <meshBasicMaterial color="#ea580c" transparent opacity={0.6} />
            </mesh>

            {/* Corner Bracket safety anchors */}
            {[-14.8, 14.8].map((cx) =>
              [-14.8, 14.8].map((cz) => (
                <group key={`${cx}-${cz}`} position={[cx, 0.01, cz]}>
                  <mesh>
                    <boxGeometry args={[1.5, 0.02, 0.15]} />
                    <meshBasicMaterial color="#f97316" />
                  </mesh>
                  <mesh rotation={[0, Math.PI / 2, 0]}>
                    <boxGeometry args={[1.5, 0.02, 0.15]} />
                    <meshBasicMaterial color="#f97316" />
                  </mesh>
                </group>
              ))
            )}
          </group>
        ))
      })()}

      {/* 5. ERECT ROOM PLATFORM STEEL FRAMING, RAILINGS & ACCESS STAIRS */}
      {halls.map((hall: any) => {
        const hasN = halls.some((h: any) => h.x === hall.x && h.z === hall.z - 1)
        const hasS = halls.some((h: any) => h.x === hall.x && h.z === hall.z + 1)
        const hasW = halls.some((h: any) => h.x === hall.x - 1 && h.z === hall.z)
        const hasE = halls.some((h: any) => h.x === hall.x + 1 && h.z === hall.z)

        return (
          <PlatformEdges 
            key={`plt-edges-${hall.id}`} 
            hallX={hall.x} 
            hallZ={hall.z} 
            hasN={hasN} 
            hasS={hasS} 
            hasW={hasW} 
            hasE={hasE} 
          />
        )
      })}



      {/* Place Access Staircase dynamically on the exposed West exit of Central (0, 0) hall */}
      {(() => {
        const centralHall = halls.find((h: any) => h.x === 0 && h.z === 0)
        const hasW = halls.some((h: any) => h.x === -1 && h.z === 0)
        if (centralHall && !hasW) {
          return (
            <PlatformStairs 
              position={[-15.0, 0, 0]} 
              rotation={[0, -Math.PI / 2, 0]} 
            />
          )
        }
        return null
      })()}

      {/* ====================================================
          6. ELEVATED ROOM INTERIORS: PARTITIONS, LINERS & RAILS
          Wrap the active halls interior assets in elevated position group (+1.6m)
          ==================================================== */}
      <group position={[0, 1.6, 0]}>
        {halls.map((hall: any) => {
          const hx = hall.x * 30
          const hz = hall.z * 30

          // Check adjacent grid neighbors
          const hasN = halls.some((h: any) => h.x === hall.x && h.z === hall.z - 1)
          const hasS = halls.some((h: any) => h.x === hall.x && h.z === hall.z + 1)
          const hasW = halls.some((h: any) => h.x === hall.x - 1 && h.z === hall.z)
          const hasE = halls.some((h: any) => h.x === hall.x + 1 && h.z === hall.z)

          return (
            <group key={`hall-int-${hall.id}`}>
              {/* Room Ceiling Plate */}
              <mesh position={[hx, CEILING_Y, hz]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[30, 30]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.65} metalness={0.15} />
              </mesh>

              {/* Charcoal Concrete Partition Walls (Only rendered on exposed boundaries) */}
              {!hasN && (
                <mesh position={[hx, CEILING_Y / 2, hz - 15]} castShadow receiveShadow>
                  <boxGeometry args={[30, CEILING_Y, 0.3]} />
                  <meshStandardMaterial color="#27272a" roughness={0.6} />
                </mesh>
              )}
              {!hasS && (
                <mesh position={[hx, CEILING_Y / 2, hz + 15]} castShadow receiveShadow>
                  <boxGeometry args={[30, CEILING_Y, 0.3]} />
                  <meshStandardMaterial color="#27272a" roughness={0.6} />
                </mesh>
              )}
              {!hasW && (
                <mesh position={[hx - 15, CEILING_Y / 2, hz]} castShadow receiveShadow>
                  <boxGeometry args={[0.3, CEILING_Y, 30]} />
                  <meshStandardMaterial color="#27272a" roughness={0.6} />
                </mesh>
              )}
              {!hasE && (
                <mesh position={[hx + 15, CEILING_Y / 2, hz]} castShadow receiveShadow>
                  <boxGeometry args={[0.3, CEILING_Y, 30]} />
                  <meshStandardMaterial color="#27272a" roughness={0.6} />
                </mesh>
              )}

              {/* Charcoal Boundary Columns (Placed along outer concrete walls) */}
              {!hasN && boundaryCoords.map((xVal, idx) => (
                <mesh key={`n-col-${idx}`} position={[hx + xVal, CEILING_Y / 2, hz - 14.6]} castShadow receiveShadow>
                  <boxGeometry args={[0.8, CEILING_Y, 0.8]} />
                  <meshStandardMaterial color="#27272a" roughness={0.5} />
                </mesh>
              ))}
              {!hasS && boundaryCoords.map((xVal, idx) => (
                <mesh key={`s-col-${idx}`} position={[hx + xVal, CEILING_Y / 2, hz + 14.6]} castShadow receiveShadow>
                  <boxGeometry args={[0.8, CEILING_Y, 0.8]} />
                  <meshStandardMaterial color="#27272a" roughness={0.5} />
                </mesh>
              ))}
              {!hasW && boundaryCoords.map((zVal, idx) => (
                <mesh key={`w-col-${idx}`} position={[hx - 14.6, CEILING_Y / 2, hz + zVal]} castShadow receiveShadow>
                  <boxGeometry args={[0.8, CEILING_Y, 0.8]} />
                  <meshStandardMaterial color="#27272a" roughness={0.5} />
                </mesh>
              ))}
              {!hasE && boundaryCoords.map((zVal, idx) => (
                <mesh key={`e-col-${idx}`} position={[hx + 14.6, CEILING_Y / 2, hz + zVal]} castShadow receiveShadow>
                  <boxGeometry args={[0.8, CEILING_Y, 0.8]} />
                  <meshStandardMaterial color="#27272a" roughness={0.5} />
                </mesh>
              ))}

              {/* Walkway Structural Pillars inside rooms */}
              {[-10.0, 0.0, 10.0].map((zVal, idx) => (
                <group key={`walkway-col-pair-${idx}`}>
                  <StructuralPillar position={[hx - 10.0, 0, hz + zVal]} height={CEILING_Y} />
                  <StructuralPillar position={[hx + 10.0, 0, hz + zVal]} height={CEILING_Y} />
                </group>
              ))}

              {/* Joint Pillars along open boundaries */}
              {hasE && [-12.5, -2.5, 7.5].map((zVal, idx) => (
                <StructuralPillar key={`e-joint-col-${idx}`} position={[hx + 15.0, 0, hz + zVal]} height={CEILING_Y} />
              ))}
              {hasS && [-10.0, 0.0, 10.0].map((xVal, idx) => (
                <StructuralPillar key={`s-joint-col-${idx}`} position={[hx + xVal, 0, hz + 15.0]} height={CEILING_Y} />
              ))}

              {/* Ceiling steel Box Girders inside rooms */}
              {boundaryCoords.map((zVal, idx) => (
                <group key={`girder-${idx}`} position={[hx, CEILING_Y - 0.2, hz + zVal]}>
                  {/* Bottom Flange */}
                  <mesh position={[0, -0.15, 0]} castShadow>
                    <boxGeometry args={[29.2, 0.05, 0.4]} />
                    <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.5} />
                  </mesh>
                  {/* Top Flange */}
                  <mesh position={[0, 0.15, 0]} castShadow>
                    <boxGeometry args={[29.2, 0.05, 0.4]} />
                    <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.5} />
                  </mesh>
                  {/* Web */}
                  <mesh castShadow>
                    <boxGeometry args={[29.2, 0.3, 0.1]} />
                    <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.5} />
                  </mesh>
                </group>
              ))}
              
              {/* Diagonal Cross-Bracing between Girders */}
              {boundaryCoords.slice(0, -1).map((zVal, idx) => {
                const nextZ = boundaryCoords[idx + 1] ?? 0
                const distZ = nextZ - zVal
                const midZ = zVal + distZ / 2
                return (
                  <group key={`bracing-${idx}`} position={[hx, CEILING_Y - 0.2, hz + midZ]}>
                    {[-10, 0, 10].map(xVal => (
                      <group key={`cross-${xVal}`} position={[xVal, 0, 0]}>
                        <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]} castShadow>
                          <boxGeometry args={[distZ * 1.4, 0.1, 0.1]} />
                          <meshStandardMaterial color="#1e293b" metalness={0.5} />
                        </mesh>
                        <mesh rotation={[Math.PI / 2, 0, -Math.PI / 4]} castShadow>
                          <boxGeometry args={[distZ * 1.4, 0.1, 0.1]} />
                          <meshStandardMaterial color="#1e293b" metalness={0.5} />
                        </mesh>
                        {/* Center Bolt Plate */}
                        <mesh position={[0, 0.06, 0]}>
                           <cylinderGeometry args={[0.1, 0.1, 0.05, 8]} />
                           <meshStandardMaterial color="#0f172a" />
                        </mesh>
                      </group>
                    ))}
                  </group>
                )
              })}

              {/* Fire Suppression Pipes */}
              <group position={[hx, CEILING_Y - 0.25, hz]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.04, 0.04, 29.0, 8]} />
                  <meshStandardMaterial color="#b91c1c" metalness={0.65} roughness={0.35} />
                </mesh>
                {[-10, -5, 0, 5, 10].map((xOffset) => (
                  <group key={xOffset} position={[xOffset, -0.05, 0]}>
                    <mesh>
                      <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
                      <meshStandardMaterial color="#b91c1c" />
                    </mesh>
                    <mesh position={[0, -0.06, 0]}>
                      <coneGeometry args={[0.03, 0.04, 8]} />
                      <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                    </mesh>
                  </group>
                ))}
              </group>

              {/* Aisle-aware Overhead Linear Lighting Rails */}
              {hallRows.map((row) => {
                const glowColor = row.aisleType === 'cold' ? '#38bdf8' : '#f97316'
                return (
                  <group key={row.id} position={[hx, CEILING_Y - 0.4, hz + row.zOffset]}>
                    <mesh>
                      <boxGeometry args={[26.0, 0.08, 0.08]} />
                      <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                    </mesh>
                    <mesh position={[0, -0.045, 0]}>
                      <boxGeometry args={[25.8, 0.02, 0.04]} />
                      <meshStandardMaterial 
                        color="#ffffff" 
                        emissive={isHot ? glowColor : '#ffffff'} 
                        emissiveIntensity={2.5} 
                      />
                    </mesh>
                    <pointLight 
                      position={[0, -0.5, 0]} 
                      intensity={isHot ? 1.6 : 0.8} 
                      distance={8} 
                      color={isHot ? glowColor : '#ffffff'} 
                    />
                    {/* Support hangers */}
                    {[-12.5, 0, 12.5].map((xOffset, rIdx) => {
                      const rodH = 0.45
                      return (
                        <mesh key={rIdx} position={[xOffset, rodH / 2, 0]}>
                          <cylinderGeometry args={[0.015, 0.015, rodH, 8]} />
                          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                        </mesh>
                      )
                    })}
                  </group>
                )
              })}
            </group>
          )
        })}

        {/* INSIDE CLUTTER: Elevated with room */}
        {halls.map((hall: any) => {
          const hx = hall.x * 30
          const hz = hall.z * 30

          const hasN = halls.some((h: any) => h.x === hall.x && h.z === hall.z - 1)
          const hasW = halls.some((h: any) => h.x === hall.x - 1 && h.z === hall.z)
          const hasE = halls.some((h: any) => h.x === hall.x + 1 && h.z === hall.z)

          return (
            <group key={`inner-clutter-${hall.id}`}>
              {!hasW && (
                <>
                  <CRAHUnit position={[hx - 14.4, 1.2, hz - 4]} rotation={[0, Math.PI / 2, 0]} />
                  <CRAHUnit position={[hx - 14.4, 1.2, hz + 5]} rotation={[0, Math.PI / 2, 0]} />
                </>
              )}
              {!hasE && <CRAHUnit position={[hx + 14.4, 1.2, hz - 5]} rotation={[0, -Math.PI / 2, 0]} />}
              {!hasN && !hasW && <UPSCabinet position={[hx - 14.5, 1.05, hz - 11]} />}
            </group>
          )
        })}

        {/* 8. DISTANT BACKGROUND CLUTTER */}
        <group>
          {/* Storage cage left */}
          <mesh position={[-50, 2, -40]} castShadow>
            <boxGeometry args={[8, 4, 4]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} wireframe />
          </mesh>
          <PalletStack position={[-42, 0, -38]} rotation={[0, Math.PI/4, 0]} />
          <PalletStack position={[-40, 0, -40]} />
          
          <MaintenanceCart position={[-35, 0, 40]} rotation={[0, -Math.PI/6, 0]} />
          
          {/* Electrical wall cabinet */}
          <mesh position={[59.5, 3, 0]} castShadow>
            <boxGeometry args={[1, 4, 3]} />
            <meshStandardMaterial color="#ef4444" metalness={0.6} roughness={0.4} />
          </mesh>

          <MaintenanceCart position={[38, 0, -38]} rotation={[0, Math.PI/3, 0]} />
          <PalletStack position={[42, 0, 40]} rotation={[0, -Math.PI/4, 0]} />
        </group>
      </group>
    </>
  )
}
