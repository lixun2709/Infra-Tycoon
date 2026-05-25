import { useMemo } from 'react'
import * as THREE from 'three'
import {} from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { RACK_HEIGHT } from '../../../physics/dimensions'
import { PREDEFINED_ROWS } from '../../../physics/zoning'

export function OverheadPowerSystem() {
  const { nodes, currentSiteId, facilityColumnsCount, hallWidthCount, halls } = useInfraStore()

  const MIN_X = -Math.floor(facilityColumnsCount / 2)
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
          <boxGeometry args={[hallWidthCount - 6, 0.16, 0.12]} />
          <meshStandardMaterial color="#7f1d1d" metalness={0.8} roughness={0.4} />
        </mesh>

        {/* B-feed trunk: Heavy muted blue distribution busduct */}
        <mesh castShadow position={[0, 0, 0.15]}>
          <boxGeometry args={[hallWidthCount - 6, 0.16, 0.12]} />
          <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.4} />
        </mesh>

        {/* Support brackets holding the main trunks */}
        {useMemo(() => {
          const coords = []
          for (let x = -Math.floor(hallWidthCount / 2) + 3; x <= Math.floor(hallWidthCount / 2) - 3; x += 4) {
            coords.push(x)
          }
          return coords
        }, [hallWidthCount]).map((x, idx) => (
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
        const hallId = row.id.split('-row-')[0]
        const hall = halls.find(h => h.id === hallId)
        if (!hall) return null

        const hx = hall.x * 30

        // Neighbors checking
        const hasE = halls.some(h => h.x === hall.x + 1 && h.z === hall.z)
        const hasW = halls.some(h => h.x === hall.x - 1 && h.z === hall.z)

        // Dynamic context-aware tray spans
        const startX = hasW ? -15.0 : -10.0
        const endX = hasE ? 15.0 : 10.0
        const trayWidth = endX - startX
        const centerX = (startX + endX) / 2

        // Dynamic rung coordinates (every 0.4m)
        const rungs: number[] = []
        for (let rx = startX; rx <= endX; rx += 0.4) {
          rungs.push(rx)
        }

        // Dynamic unistrut support hanger coordinates (every 2m, omitting walkway column positions at Math.abs(x) === 10)
        const hangers: number[] = []
        for (let hxVal = Math.ceil((startX + 1.0) / 2) * 2; hxVal <= Math.floor((endX - 1.0) / 2) * 2; hxVal += 2) {
          if (Math.abs(hxVal) !== 10) {
            hangers.push(hxVal)
          }
        }

        // Dynamic joint coordinates for busways (every 4m)
        const joints: number[] = []
        for (let jx = Math.ceil(startX / 4) * 4; jx <= Math.floor(endX / 4) * 4; jx += 4) {
          joints.push(jx)
        }

        const FIBER_Y = TRAY_Y + 0.12

        return (
          <group key={row.id} position={[hx, 0, 0]}>
            {/* 1. Ladder Tray (Suspended Steel Cable Grid) */}
            <group position={[0, TRAY_Y, row.z]}>
              {/* Steel Side Rail Front */}
              <mesh castShadow position={[centerX, 0, -0.28]}>
                <boxGeometry args={[trayWidth, 0.04, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Steel Side Rail Rear */}
              <mesh castShadow position={[centerX, 0, 0.28]}>
                <boxGeometry args={[trayWidth, 0.04, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Ladder Rungs */}
              {rungs.map((rX, idx) => (
                <mesh key={idx} position={[rX, 0, 0]}>
                  <boxGeometry args={[0.02, 0.015, 0.54]} />
                  <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
                </mesh>
              ))}
            </group>

            {/* 2. Vibrant Yellow Fiber Optic Guide Tray (Solid Duct Network) */}
            <mesh castShadow position={[centerX, FIBER_Y, row.z + 0.4]}>
              <boxGeometry args={[trayWidth, 0.06, 0.14]} />
              <meshStandardMaterial color="#eab308" metalness={0.4} roughness={0.3} />
            </mesh>

            {/* 3. Redundant A/B Electrical Busway Rails */}
            <group position={[0, BUSWAY_Y, row.z]}>
              {/* Feed A Rail (Muted Red) */}
              <mesh castShadow position={[centerX, 0, -0.15]}>
                <boxGeometry args={[trayWidth, 0.08, 0.08]} />
                <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Feed B Rail (Muted Blue) */}
              <mesh castShadow position={[centerX, 0, 0.15]}>
                <boxGeometry args={[trayWidth, 0.08, 0.08]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.3} />
              </mesh>

              {/* Section connection joints along the rails */}
              {joints.map((jX, idx) => (
                <group key={idx} position={[jX, 0, 0]}>
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

            {/* 4. Ceiling Unistrut Support Hangers (Avoids columns at 10m walkway grid) */}
            {hangers.map((hX, idx) => {
              const rodHeight = CEILING_Y - TRAY_Y
              const rodCenterY = TRAY_Y + rodHeight / 2

              return (
                <group key={idx} position={[hX, rodCenterY, row.z]}>
                  {/* Horizontal unistrut support channel under the tray */}
                  <mesh position={[0, -rodHeight / 2 - 0.02, 0]}>
                    <boxGeometry args={[0.05, 0.03, 0.72]} />
                    <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
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

            {/* 5. Physical Row Connection Feeder To Facility Electrical Main Trunks */}
            {/* ONLY rendered for the central (0, 0) hall to prevent floating bridges outside room perimeters */}
            {hall && hall.x === 0 && hall.z === 0 && (
              <group position={[MIN_X - 0.4, MAIN_TRUNK_Y - 0.15, (row.z + TRUNK_Z) / 2]}>
                {/* Feeder tray connector */}
                <mesh castShadow>
                  <boxGeometry args={[0.3, 0.03, Math.abs(row.z - TRUNK_Z)]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
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

                {/* Ceiling support suspension hanger rods along the long bridge length */}
                {(() => {
                  const bridgeLength = Math.abs(row.z - TRUNK_Z)
                  const numHangers = Math.max(1, Math.floor(bridgeLength / 4))
                  const startZ = -bridgeLength / 2
                  const rods = []
                  for (let i = 0; i <= numHangers; i++) {
                    const localZ = startZ + (i / numHangers) * bridgeLength
                    if (i > 0 && i < numHangers) {
                      rods.push(localZ)
                    }
                  }
                  if (rods.length === 0) {
                    rods.push(0)
                  }
                  return rods
                })().map((localZ, rIdx) => {
                  const rodHeight = CEILING_Y - (MAIN_TRUNK_Y - 0.15)
                  return (
                    <mesh key={rIdx} position={[0, rodHeight / 2, localZ]}>
                      <cylinderGeometry args={[0.012, 0.012, rodHeight, 6]} />
                      <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                    </mesh>
                  )
                })}
              </group>
            )}
          </group>
        )
      })}

      {/* ====================================================
          6. LONGITUDINAL WALKWAY UTILITY CHANNELS (Connecting all rows)
          ==================================================== */}
      {halls.map(hall => {
        const hx = hall.x * 30
        const hz = hall.z * 30

        const hasN = halls.some(h => h.x === hall.x && h.z === hall.z - 1)
        const hasS = halls.some(h => h.x === hall.x && h.z === hall.z + 1)

        // Dynamic walkway Z bounds
        const startZ = hasN ? -15.0 : -10.0
        const endZ = hasS ? 15.0 : 10.0
        const trayLength = endZ - startZ
        const centerZ = (startZ + endZ) / 2

        // Walkway ladder tray rungs (every 0.4m along Z)
        const walkwayRungs: number[] = []
        for (let rz = startZ; rz <= endZ; rz += 0.4) {
          walkwayRungs.push(rz)
        }

        const FIBER_Y = TRAY_Y + 0.12

        return (
          <group key={`walkway-infra-${hall.id}`} position={[hx, 0, hz]}>
            {/* Render utility channels for Left (x = -10) and Right (x = 10) walkways */}
            {[-10.0, 10.0].map(walkwayX => (
              <group key={walkwayX}>
                {/* A. Ladder Tray (Suspended Steel Cable Grid) */}
                <group position={[walkwayX, TRAY_Y, centerZ]}>
                  {/* Steel Side Rail Left */}
                  <mesh castShadow position={[-0.28, 0, 0]}>
                    <boxGeometry args={[0.02, 0.04, trayLength]} />
                    <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  </mesh>
                  {/* Steel Side Rail Right */}
                  <mesh castShadow position={[0.28, 0, 0]}>
                    <boxGeometry args={[0.02, 0.04, trayLength]} />
                    <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  </mesh>
                  {/* Ladder Rungs */}
                  {walkwayRungs.map((rZ, idx) => (
                    <mesh key={idx} position={[0, 0, rZ - centerZ]}>
                      <boxGeometry args={[0.54, 0.015, 0.02]} />
                      <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
                    </mesh>
                  ))}
                </group>

                {/* B. Yellow Fiber Optic Guide Tray (Solid Duct Network) */}
                <mesh castShadow position={[walkwayX, FIBER_Y, centerZ]}>
                  <boxGeometry args={[0.14, 0.06, trayLength]} />
                  <meshStandardMaterial color="#eab308" metalness={0.4} roughness={0.3} />
                </mesh>

                {/* C. Redundant A/B Electrical Busways */}
                <group position={[walkwayX, BUSWAY_Y, centerZ]}>
                  {/* Feed A Rail (Muted Red) */}
                  <mesh castShadow position={[-0.15, 0, 0]}>
                    <boxGeometry args={[0.08, 0.08, trayLength]} />
                    <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.3} />
                  </mesh>
                  {/* Feed B Rail (Muted Blue) */}
                  <mesh castShadow position={[0.15, 0, 0]}>
                    <boxGeometry args={[0.08, 0.08, trayLength]} />
                    <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.3} />
                  </mesh>
                </group>

                {/* D. Walkway Unistrut Support Hangers */}
                {walkwayRungs.map((rZ, idx) => {
                  if (idx % 5 !== 0) return null // Every 2m
                  const rodHeight = CEILING_Y - TRAY_Y
                  const rodCenterY = TRAY_Y + rodHeight / 2
                  return (
                    <group key={`w-hanger-${idx}`} position={[walkwayX, rodCenterY, rZ]}>
                      {/* Horizontal unistrut support channel under the tray */}
                      <mesh position={[0, -rodHeight / 2 - 0.02, 0]}>
                        <boxGeometry args={[0.54, 0.03, 0.05]} />
                        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
                      </mesh>
                      {/* Threaded steel suspension rod Left */}
                      <mesh position={[-0.27, 0, 0]}>
                        <boxGeometry args={[0.015, rodHeight, 0.015]} />
                        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                      </mesh>
                      {/* Threaded steel suspension rod Right */}
                      <mesh position={[0.27, 0, 0]}>
                        <boxGeometry args={[0.015, rodHeight, 0.015]} />
                        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                      </mesh>
                    </group>
                  )
                })}
              </group>
            ))}
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
              </mesh>

              {/* Entrance junction box on the top of the rack */}
              <mesh position={[rX - 0.15, RACK_HEIGHT + 0.03, rZ - 0.35]}>
                <boxGeometry args={[0.08, 0.06, 0.08]} />
                <meshStandardMaterial color="#334155" metalness={0.9} />
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
              </mesh>

              {/* Entrance junction box on the top of the rack */}
              <mesh position={[rX + 0.15, RACK_HEIGHT + 0.03, rZ + 0.35]}>
                <boxGeometry args={[0.08, 0.06, 0.08]} />
                <meshStandardMaterial color="#334155" metalness={0.9} />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}
