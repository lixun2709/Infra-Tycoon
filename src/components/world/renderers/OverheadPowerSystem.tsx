import { useMemo } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { RACK_HEIGHT } from '../../../physics/dimensions'
import { PREDEFINED_ROWS } from '../../../physics/zoning'

// All permanent rows span from x = -8 to x = 8
const MIN_X = -8
const MAX_X = 8
const ROW_LENGTH = (MAX_X - MIN_X) + 1.2 // 17.2

export function OverheadPowerSystem() {
  const { nodes, currentSiteId } = useInfraStore()

  // Find all active racks in the current site room
  const activeRacks = useMemo(() => {
    return nodes
      .filter(n => n.type === 'rack' && n.siteId === currentSiteId)
      .map(r => ({
        id: r.id,
        position: new THREE.Vector3(r.position.x, r.position.y, r.position.z),
        name: r.name
      }))
  }, [nodes, currentSiteId])

  // Constants for infrastructure proportions
  const CEILING_Y = 5.5
  const TRAY_Y = RACK_HEIGHT + 0.35 // 2.45
  const BUSWAY_Y = TRAY_Y + 0.25 // 2.70
  const MAIN_TRUNK_Y = TRAY_Y + 0.55 // 3.00
  const TRUNK_Z = -12.0 // Facility wall where main electrical distribution is anchored

  // Determine spacing for support hangers (every 2 units, centered)
  const hangerCoords = useMemo(() => {
    const coords = []
    for (let x = MIN_X; x <= MAX_X; x += 2) {
      coords.push(x)
    }
    return coords
  }, [])

  // Determine spacing for ladder tray cross-rungs (every 0.4 units)
  const rungCoords = useMemo(() => {
    const coords = []
    const startRung = MIN_X - 0.5
    const endRung = MAX_X + 0.5
    for (let r = startRung; r <= endRung; r += 0.4) {
      coords.push(r)
    }
    return coords
  }, [])

  return (
    <group>
      {/* ====================================================
          ELECTRICAL ROOM & MAIN DISTRIBUTION ENCLOSURES
          ==================================================== */}
      <group position={[-10.0, 1.4, TRUNK_Z - 0.5]}>
        {/* Main Facility Power Control Center Enclosure (Heavy UPS/Distribution Bank) */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.2, 2.8, 1.0]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          <Edges color="#475569" />
        </mesh>
        
        {/* Believable mimic indicators / status panels */}
        <mesh position={[-0.9, 0.4, 0.51]}>
          <planeGeometry args={[0.8, 1.2]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* Muted green system status lights */}
        <mesh position={[-0.9, 0.8, 0.52]}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>
        
        {/* A/B Power Feed monitoring LCD displays */}
        <mesh position={[0.4, 0.4, 0.51]}>
          <planeGeometry args={[1.2, 0.8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* A/B LCD active load bars */}
        <mesh position={[0.1, 0.4, 0.52]}>
          <planeGeometry args={[0.4, 0.15]} />
          <meshStandardMaterial color="#991b1b" emissive="#991b1b" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.7, 0.4, 0.52]}>
          <planeGeometry args={[0.4, 0.15]} />
          <meshStandardMaterial color="#1e3a8a" emissive="#1e3a8a" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* ====================================================
          MAIN OVERHEAD FEEDER TRUNKS (From Electrical Enclosures)
          ==================================================== */}
      {/* High-voltage heavy busduct headers suspended at wall boundary Z = -12 */}
      <group position={[0, MAIN_TRUNK_Y, TRUNK_Z]}>
        {/* A-feed trunk: Heavy muted red distribution busduct */}
        <mesh castShadow position={[0, 0, -0.15]}>
          <boxGeometry args={[22.0, 0.16, 0.12]} />
          <meshStandardMaterial color="#7f1d1d" metalness={0.8} roughness={0.4} />
          <Edges color="#991b1b" />
        </mesh>

        {/* B-feed trunk: Heavy muted blue distribution busduct */}
        <mesh castShadow position={[0, 0, 0.15]}>
          <boxGeometry args={[22.0, 0.16, 0.12]} />
          <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.4} />
          <Edges color="#2563eb" />
        </mesh>

        {/* Support brackets holding the main trunks */}
        {[-9, -5, -1, 3, 7].map((x, idx) => (
          <group key={idx} position={[x, 0, 0]}>
            {/* Horizontal steel unistrut carrier hanger */}
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.06, 0.04, 0.7]} />
              <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Suspended rods holding the unistrut to ceiling */}
            <mesh position={[0, (CEILING_Y - MAIN_TRUNK_Y) / 2, -0.3]}>
              <boxGeometry args={[0.015, CEILING_Y - MAIN_TRUNK_Y, 0.015]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} />
            </mesh>
            <mesh position={[0, (CEILING_Y - MAIN_TRUNK_Y) / 2, 0.3]}>
              <boxGeometry args={[0.015, CEILING_Y - MAIN_TRUNK_Y, 0.015]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ====================================================
          PERMANENT ROW INFRASTRUCTURE (Ladder Trays & Busways)
          ==================================================== */}
      {PREDEFINED_ROWS.map(row => {
        return (
          <group key={row.id}>
            {/* 1. Ladder Tray (Suspended Steel Cable Grid) */}
            <group position={[0, TRAY_Y, row.z]}>
              {/* Steel Side Rail Front */}
              <mesh castShadow position={[0, 0, -0.28]}>
                <boxGeometry args={[ROW_LENGTH, 0.04, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                <Edges color="#64748b" />
              </mesh>
              {/* Steel Side Rail Rear */}
              <mesh castShadow position={[0, 0, 0.28]}>
                <boxGeometry args={[ROW_LENGTH, 0.04, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                <Edges color="#64748b" />
              </mesh>
              {/* Ladder Rungs */}
              {rungCoords.map((rX, idx) => (
                <mesh key={idx} position={[rX, 0, 0]}>
                  <boxGeometry args={[0.02, 0.015, 0.54]} />
                  <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
                </mesh>
              ))}
            </group>

            {/* 2. Redundant A/B Electrical Busway Rails */}
            <group position={[0, BUSWAY_Y, row.z]}>
              {/* Feed A Rail (Muted Red) */}
              <mesh castShadow position={[0, 0, -0.15]}>
                <boxGeometry args={[ROW_LENGTH, 0.08, 0.08]} />
                <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.3} />
                <Edges color="#7f1d1d" />
              </mesh>
              {/* Feed B Rail (Muted Blue) */}
              <mesh castShadow position={[0, 0, 0.15]}>
                <boxGeometry args={[ROW_LENGTH, 0.08, 0.08]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.3} />
                <Edges color="#172554" />
              </mesh>

              {/* Section connection joints along the rails */}
              {hangerCoords.map((hX, idx) => (
                <group key={idx} position={[hX, 0, 0]}>
                  <mesh position={[0, 0, -0.15]}>
                    <boxGeometry args={[0.1, 0.09, 0.09]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} />
                  </mesh>
                  <mesh position={[0, 0, 0.15]}>
                    <boxGeometry args={[0.1, 0.09, 0.09]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} />
                  </mesh>
                </group>
              ))}
            </group>

            {/* 3. Ceiling Unistrut Support Hangers */}
            {hangerCoords.map((hX, idx) => {
              const rodHeight = CEILING_Y - TRAY_Y
              const rodCenterY = TRAY_Y + rodHeight / 2

              return (
                <group key={idx} position={[hX, rodCenterY, row.z]}>
                  {/* Horizontal unistrut support channel under the tray */}
                  <mesh position={[0, -rodHeight / 2 - 0.02, 0]}>
                    <boxGeometry args={[0.05, 0.03, 0.72]} />
                    <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
                    <Edges color="#334155" />
                  </mesh>

                  {/* Threaded steel suspension rod Rear */}
                  <mesh position={[0, 0, -0.32]}>
                    <boxGeometry args={[0.015, rodHeight, 0.015]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                  </mesh>

                  {/* Threaded steel suspension rod Front */}
                  <mesh position={[0, 0, 0.32]}>
                    <boxGeometry args={[0.015, rodHeight, 0.015]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                  </mesh>
                </group>
              )
            })}

            {/* 4. Physical Row Connection Feeder To Facility Electrical Main Trunks */}
            {/* Runs a bridge unistrut-feeder duct from the left end of the row (x = -8.4) back to Z = -12 trunks */}
            <group position={[MIN_X - 0.4, MAIN_TRUNK_Y - 0.15, (row.z + TRUNK_Z) / 2]}>
              {/* Feeder tray connector */}
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.03, Math.abs(row.z - TRUNK_Z)]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
                <Edges color="#475569" />
              </mesh>
              {/* Rigid insulated feeder conduits carrying massive sub-feeds */}
              <mesh position={[-0.08, 0.05, 0]}>
                <boxGeometry args={[0.05, 0.05, Math.abs(row.z - TRUNK_Z)]} />
                <meshStandardMaterial color="#7f1d1d" metalness={0.8} />
              </mesh>
              <mesh position={[0.08, 0.05, 0]}>
                <boxGeometry args={[0.05, 0.05, Math.abs(row.z - TRUNK_Z)]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.8} />
              </mesh>
            </group>
          </group>
        )
      })}

      {/* ====================================================
          RACK-LEVEL ACTIVE POWER DROPS (Cabled when Rack exists)
          ==================================================== */}
      {activeRacks.map(rack => {
        const rX = rack.position.x
        const rZ = rack.position.z

        return (
          <group key={rack.id}>
            {/* Feed A Drop Conduit (Branch off red busway) */}
            <group>
              {/* Horizontal branch conduit off busway duct */}
              <mesh position={[rX - 0.15, BUSWAY_Y, rZ - 0.25]}>
                <boxGeometry args={[0.04, 0.04, 0.2]} />
                <meshStandardMaterial color="#991b1b" metalness={0.7} />
              </mesh>
              
              {/* Vertical conduit drop whip down to the top of the cabinet */}
              <mesh position={[rX - 0.15, (BUSWAY_Y + RACK_HEIGHT) / 2, rZ - 0.35]}>
                <boxGeometry args={[0.03, BUSWAY_Y - RACK_HEIGHT, 0.03]} />
                <meshStandardMaterial color="#b91c1c" metalness={0.8} roughness={0.2} />
                <Edges color="#7f1d1d" />
              </mesh>

              {/* Entrance junction box on the top of the rack */}
              <mesh position={[rX - 0.15, RACK_HEIGHT + 0.03, rZ - 0.35]}>
                <boxGeometry args={[0.08, 0.06, 0.08]} />
                <meshStandardMaterial color="#334155" metalness={0.9} />
                <Edges color="#475569" />
              </mesh>
            </group>

            {/* Feed B Drop Conduit (Branch off blue busway) */}
            <group>
              {/* Horizontal branch conduit off busway duct */}
              <mesh position={[rX + 0.15, BUSWAY_Y, rZ + 0.25]}>
                <boxGeometry args={[0.04, 0.04, 0.2]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.7} />
              </mesh>
              
              {/* Vertical conduit drop whip down to the top of the cabinet */}
              <mesh position={[rX + 0.15, (BUSWAY_Y + RACK_HEIGHT) / 2, rZ + 0.35]}>
                <boxGeometry args={[0.03, BUSWAY_Y - RACK_HEIGHT, 0.03]} />
                <meshStandardMaterial color="#1d4ed8" metalness={0.8} roughness={0.2} />
                <Edges color="#172554" />
              </mesh>

              {/* Entrance junction box on the top of the rack */}
              <mesh position={[rX + 0.15, RACK_HEIGHT + 0.03, rZ + 0.35]}>
                <boxGeometry args={[0.08, 0.06, 0.08]} />
                <meshStandardMaterial color="#334155" metalness={0.9} />
                <Edges color="#475569" />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}
