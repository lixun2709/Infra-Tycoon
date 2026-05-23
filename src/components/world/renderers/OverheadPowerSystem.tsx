import { useMemo } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useInfraStore } from '../../../store/useInfraStore'
import { RACK_HEIGHT } from '../../../physics/dimensions'

interface RowSegment {
  id: string
  axis: 'X' | 'Z'
  constantCoord: number // Z if axis is X, X if axis is Z
  minCoord: number
  maxCoord: number
  racks: Array<{
    id: string
    position: THREE.Vector3
    name: string
  }>
}

export function OverheadPowerSystem() {
  const { nodes, currentSiteId } = useInfraStore()

  // 1. Filter racks in the current active site room
  const racks = useMemo(() => {
    return nodes
      .filter(n => n.type === 'rack' && n.siteId === currentSiteId)
      .map(r => ({
        id: r.id,
        position: new THREE.Vector3(r.position.x, r.position.y, r.position.z),
        name: r.name
      }))
  }, [nodes, currentSiteId])

  // 2. Cluster racks dynamically into contiguous row segments
  const rowSegments = useMemo(() => {
    if (racks.length === 0) return []

    const xSegments: RowSegment[] = []
    const groupedByZ: Record<number, typeof racks> = {}

    racks.forEach(r => {
      const z = Math.round(r.position.z)
      if (!groupedByZ[z]) groupedByZ[z] = []
      groupedByZ[z].push(r)
    })

    Object.entries(groupedByZ).forEach(([zStr, zRacks]) => {
      const zVal = parseFloat(zStr)
      zRacks.sort((a, b) => a.position.x - b.position.x)

      let currentSegment: typeof racks = []
      for (let i = 0; i < zRacks.length; i++) {
        const rack = zRacks[i]
        if (!rack) continue
        if (currentSegment.length === 0) {
          currentSegment.push(rack)
        } else {
          const prevRack = currentSegment[currentSegment.length - 1]
          if (!prevRack) continue
          if (rack.position.x - prevRack.position.x <= 1.5) {
            currentSegment.push(rack)
          } else {
            const firstRack = currentSegment[0]
            const lastRack = currentSegment[currentSegment.length - 1]
            if (firstRack && lastRack) {
              xSegments.push({
                id: `x-row-${zVal}-${firstRack.id}`,
                axis: 'X',
                constantCoord: zVal,
                minCoord: firstRack.position.x,
                maxCoord: lastRack.position.x,
                racks: currentSegment
              })
            }
            currentSegment = [rack]
          }
        }
      }
      if (currentSegment.length > 0) {
        const firstRack = currentSegment[0]
        const lastRack = currentSegment[currentSegment.length - 1]
        if (firstRack && lastRack) {
          xSegments.push({
            id: `x-row-${zVal}-${firstRack.id}`,
            axis: 'X',
            constantCoord: zVal,
            minCoord: firstRack.position.x,
            maxCoord: lastRack.position.x,
            racks: currentSegment
          })
        }
      }
    })

    const zSegments: RowSegment[] = []
    const groupedByX: Record<number, typeof racks> = {}

    racks.forEach(r => {
      const x = Math.round(r.position.x)
      if (!groupedByX[x]) groupedByX[x] = []
      groupedByX[x].push(r)
    })

    Object.entries(groupedByX).forEach(([xStr, xRacks]) => {
      const xVal = parseFloat(xStr)
      xRacks.sort((a, b) => a.position.z - b.position.z)

      let currentSegment: typeof racks = []
      for (let i = 0; i < xRacks.length; i++) {
        const rack = xRacks[i]
        if (!rack) continue
        if (currentSegment.length === 0) {
          currentSegment.push(rack)
        } else {
          const prevRack = currentSegment[currentSegment.length - 1]
          if (!prevRack) continue
          if (rack.position.z - prevRack.position.z <= 1.5) {
            currentSegment.push(rack)
          } else {
            const firstRack = currentSegment[0]
            const lastRack = currentSegment[currentSegment.length - 1]
            if (firstRack && lastRack) {
              zSegments.push({
                id: `z-row-${xVal}-${firstRack.id}`,
                axis: 'Z',
                constantCoord: xVal,
                minCoord: firstRack.position.z,
                maxCoord: lastRack.position.z,
                racks: currentSegment
              })
            }
            currentSegment = [rack]
          }
        }
      }
      if (currentSegment.length > 0) {
        const firstRack = currentSegment[0]
        const lastRack = currentSegment[currentSegment.length - 1]
        if (firstRack && lastRack) {
          zSegments.push({
            id: `z-row-${xVal}-${firstRack.id}`,
            axis: 'Z',
            constantCoord: xVal,
            minCoord: firstRack.position.z,
            maxCoord: lastRack.position.z,
            racks: currentSegment
          })
        }
      }
    })

    // Deduplicate: If a rack belongs to a row of length > 1, prioritize it.
    const finalSegments: RowSegment[] = []
    const processedRackIds = new Set<string>()

    xSegments.forEach(seg => {
      if (seg.racks.length > 1) {
        finalSegments.push(seg)
        seg.racks.forEach(r => processedRackIds.add(r.id))
      }
    })

    zSegments.forEach(seg => {
      const unprocessed = seg.racks.filter(r => !processedRackIds.has(r.id))
      if (unprocessed.length > 1) {
        const firstRack = unprocessed[0]
        const lastRack = unprocessed[unprocessed.length - 1]
        if (firstRack && lastRack) {
          finalSegments.push({
            id: seg.id,
            axis: 'Z',
            constantCoord: seg.constantCoord,
            minCoord: firstRack.position.z,
            maxCoord: lastRack.position.z,
            racks: unprocessed
          })
        }
        unprocessed.forEach(r => processedRackIds.add(r.id))
      }
    })

    racks.forEach(r => {
      if (!processedRackIds.has(r.id)) {
        finalSegments.push({
          id: `single-${r.id}`,
          axis: 'X',
          constantCoord: r.position.z,
          minCoord: r.position.x,
          maxCoord: r.position.x,
          racks: [r]
        })
        processedRackIds.add(r.id)
      }
    })

    return finalSegments
  }, [racks])

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
          ROW-SPECIFIC INFRASTRUCTURE (Busways, Trays, Hangers, Drops)
          ==================================================== */}
      {rowSegments.map(row => {
        const length = (row.maxCoord - row.minCoord) + 1.2
        const centerCoord = (row.minCoord + row.maxCoord) / 2

        // Determine spacing for support hangers (every 2 units, centered)
        const hangers = []
        for (let coord = Math.ceil(row.minCoord); coord <= Math.floor(row.maxCoord); coord += 2) {
          hangers.push(coord)
        }
        if (hangers.length === 0) {
          hangers.push(centerCoord)
        }

        // Determine spacing for ladder tray cross-rungs (every 0.4 units)
        const rungs = []
        const startRung = row.minCoord - 0.5
        const endRung = row.maxCoord + 0.5
        for (let rCoord = startRung; rCoord <= endRung; rCoord += 0.4) {
          rungs.push(rCoord)
        }

        return (
          <group key={row.id}>
            {/* 1. Ladder Tray (Suspended Steel Cable Grid) */}
            {row.axis === 'X' ? (
              <group position={[centerCoord, TRAY_Y, row.constantCoord]}>
                {/* Steel Side Rail Front */}
                <mesh castShadow position={[0, 0, -0.28]}>
                  <boxGeometry args={[length, 0.04, 0.02]} />
                  <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  <Edges color="#64748b" />
                </mesh>
                {/* Steel Side Rail Rear */}
                <mesh castShadow position={[0, 0, 0.28]}>
                  <boxGeometry args={[length, 0.04, 0.02]} />
                  <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  <Edges color="#64748b" />
                </mesh>
                {/* Ladder Rungs */}
                {rungs.map((rCoord, idx) => (
                  <mesh key={idx} position={[rCoord - centerCoord, 0, 0]}>
                    <boxGeometry args={[0.02, 0.015, 0.54]} />
                    <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
                  </mesh>
                ))}
              </group>
            ) : (
              <group position={[row.constantCoord, TRAY_Y, centerCoord]}>
                {/* Steel Side Rail Left */}
                <mesh castShadow position={[-0.28, 0, 0]}>
                  <boxGeometry args={[0.02, 0.04, length]} />
                  <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  <Edges color="#64748b" />
                </mesh>
                {/* Steel Side Rail Right */}
                <mesh castShadow position={[0.28, 0, 0]}>
                  <boxGeometry args={[0.02, 0.04, length]} />
                  <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  <Edges color="#64748b" />
                </mesh>
                {/* Ladder Rungs */}
                {rungs.map((rCoord, idx) => (
                  <mesh key={idx} position={[0, 0, rCoord - centerCoord]}>
                    <boxGeometry args={[0.54, 0.015, 0.02]} />
                    <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
                  </mesh>
                ))}
              </group>
            )}

            {/* 2. Redundant A/B Electrical Busway Rails */}
            {row.axis === 'X' ? (
              <group position={[centerCoord, BUSWAY_Y, row.constantCoord]}>
                {/* Feed A Rail (Muted Red) */}
                <mesh castShadow position={[0, 0, -0.15]}>
                  <boxGeometry args={[length, 0.08, 0.08]} />
                  <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.3} />
                  <Edges color="#7f1d1d" />
                </mesh>
                {/* Feed B Rail (Muted Blue) */}
                <mesh castShadow position={[0, 0, 0.15]}>
                  <boxGeometry args={[length, 0.08, 0.08]} />
                  <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.3} />
                  <Edges color="#172554" />
                </mesh>

                {/* Section connection joints along the rails */}
                {hangers.map((hCoord, idx) => (
                  <group key={idx} position={[hCoord - centerCoord, 0, 0]}>
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
            ) : (
              <group position={[row.constantCoord, BUSWAY_Y, centerCoord]}>
                {/* Feed A Rail (Muted Red) */}
                <mesh castShadow position={[-0.15, 0, 0]}>
                  <boxGeometry args={[0.08, 0.08, length]} />
                  <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.3} />
                  <Edges color="#7f1d1d" />
                </mesh>
                {/* Feed B Rail (Muted Blue) */}
                <mesh castShadow position={[0.15, 0, 0]}>
                  <boxGeometry args={[0.08, 0.08, length]} />
                  <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.3} />
                  <Edges color="#172554" />
                </mesh>

                {/* Section connection joints along the rails */}
                {hangers.map((hCoord, idx) => (
                  <group key={idx} position={[0, 0, hCoord - centerCoord]}>
                    <mesh position={[-0.15, 0, 0]}>
                      <boxGeometry args={[0.09, 0.09, 0.1]} />
                      <meshStandardMaterial color="#64748b" metalness={0.9} />
                    </mesh>
                    <mesh position={[0.15, 0, 0]}>
                      <boxGeometry args={[0.09, 0.09, 0.1]} />
                      <meshStandardMaterial color="#64748b" metalness={0.9} />
                    </mesh>
                  </group>
                ))}
              </group>
            )}

            {/* 3. Ceiling Unistrut Support Hangers */}
            {hangers.map((hCoord, idx) => {
              const rodHeight = CEILING_Y - TRAY_Y
              const rodCenterY = TRAY_Y + rodHeight / 2
              const xPos = row.axis === 'X' ? hCoord : row.constantCoord
              const zPos = row.axis === 'X' ? row.constantCoord : hCoord

              return (
                <group key={idx} position={[xPos, rodCenterY, zPos]}>
                  {/* Horizontal unistrut support channel under the tray */}
                  <mesh position={[0, -rodHeight / 2 - 0.02, 0]}>
                    <boxGeometry args={[row.axis === 'X' ? 0.05 : 0.72, 0.03, row.axis === 'X' ? 0.72 : 0.05]} />
                    <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
                    <Edges color="#334155" />
                  </mesh>

                  {/* Threaded steel suspension rod Left/Rear */}
                  <mesh position={[row.axis === 'X' ? 0 : -0.32, 0, row.axis === 'X' ? -0.32 : 0]}>
                    <boxGeometry args={[0.015, rodHeight, 0.015]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                  </mesh>

                  {/* Threaded steel suspension rod Right/Front */}
                  <mesh position={[row.axis === 'X' ? 0 : 0.32, 0, row.axis === 'X' ? 0.32 : 0]}>
                    <boxGeometry args={[0.015, rodHeight, 0.015]} />
                    <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
                  </mesh>
                </group>
              )
            })}

            {/* 4. Physical Row Connection Feeder To Facility Electrical Main Trunks */}
            {row.axis === 'X' ? (
              // For X-running rows, run a bridge tray from its minCoord back to Z = -12 main trunks
              <group position={[row.minCoord - 0.4, MAIN_TRUNK_Y - 0.15, (row.constantCoord + TRUNK_Z) / 2]}>
                {/* Feeder tray connector */}
                <mesh castShadow>
                  <boxGeometry args={[0.3, 0.03, Math.abs(row.constantCoord - TRUNK_Z)]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
                  <Edges color="#475569" />
                </mesh>
                {/* Rigid insulated feeder conduits carrying massive sub-feeds */}
                <mesh position={[-0.08, 0.05, 0]}>
                  <boxGeometry args={[0.05, 0.05, Math.abs(row.constantCoord - TRUNK_Z)]} />
                  <meshStandardMaterial color="#7f1d1d" metalness={0.8} />
                </mesh>
                <mesh position={[0.08, 0.05, 0]}>
                  <boxGeometry args={[0.05, 0.05, Math.abs(row.constantCoord - TRUNK_Z)]} />
                  <meshStandardMaterial color="#1e3a8a" metalness={0.8} />
                </mesh>
              </group>
            ) : (
              // For Z-running rows, extend the actual row busway lines all the way to Z = -12 main trunks
              <group position={[row.constantCoord, BUSWAY_Y, (row.minCoord - 0.5 + TRUNK_Z) / 2]}>
                {/* Extends Feed A busway back to main trunk */}
                <mesh castShadow position={[-0.15, 0, 0]}>
                  <boxGeometry args={[0.08, 0.08, Math.abs(row.minCoord - 0.5 - TRUNK_Z)]} />
                  <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.3} />
                  <Edges color="#7f1d1d" />
                </mesh>
                {/* Extends Feed B busway back to main trunk */}
                <mesh castShadow position={[0.15, 0, 0]}>
                  <boxGeometry args={[0.08, 0.08, Math.abs(row.minCoord - 0.5 - TRUNK_Z)]} />
                  <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.3} />
                  <Edges color="#172554" />
                </mesh>
                {/* Extends Ladder Tray */}
                <mesh castShadow position={[0, -0.25, 0]}>
                  <boxGeometry args={[0.6, 0.03, Math.abs(row.minCoord - 0.5 - TRUNK_Z)]} />
                  <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
                  <Edges color="#64748b" />
                </mesh>
              </group>
            )}

            {/* ====================================================
                RACK-LEVEL INDIVIDUAL POWER DROPS (Cables/Conduits)
                ==================================================== */}
            {row.racks.map(rack => {
              const rX = rack.position.x
              const rZ = rack.position.z

              return (
                <group key={rack.id}>
                  {/* Feed A Drop Conduit (Branch off red busway) */}
                  <group>
                    {/* Horizontal branch conduit off busway duct */}
                    <mesh position={[
                      row.axis === 'X' ? rX - 0.15 : rX - 0.25,
                      BUSWAY_Y,
                      row.axis === 'X' ? rZ - 0.25 : rZ - 0.15
                    ]}>
                      <boxGeometry args={[
                        row.axis === 'X' ? 0.04 : 0.2,
                        0.04,
                        row.axis === 'X' ? 0.2 : 0.04
                      ]} />
                      <meshStandardMaterial color="#991b1b" metalness={0.7} />
                    </mesh>
                    
                    {/* Vertical conduit drop whip down to the top of the cabinet */}
                    <mesh position={[
                      row.axis === 'X' ? rX - 0.15 : rX - 0.35,
                      (BUSWAY_Y + RACK_HEIGHT) / 2,
                      row.axis === 'X' ? rZ - 0.35 : rZ - 0.15
                    ]}>
                      <boxGeometry args={[0.03, BUSWAY_Y - RACK_HEIGHT, 0.03]} />
                      <meshStandardMaterial color="#b91c1c" metalness={0.8} roughness={0.2} />
                      <Edges color="#7f1d1d" />
                    </mesh>

                    {/* Entrance junction box on the top of the rack */}
                    <mesh position={[
                      row.axis === 'X' ? rX - 0.15 : rX - 0.35,
                      RACK_HEIGHT + 0.03,
                      row.axis === 'X' ? rZ - 0.35 : rZ - 0.15
                    ]}>
                      <boxGeometry args={[0.08, 0.06, 0.08]} />
                      <meshStandardMaterial color="#334155" metalness={0.9} />
                      <Edges color="#475569" />
                    </mesh>
                  </group>

                  {/* Feed B Drop Conduit (Branch off blue busway) */}
                  <group>
                    {/* Horizontal branch conduit off busway duct */}
                    <mesh position={[
                      row.axis === 'X' ? rX + 0.15 : rX + 0.25,
                      BUSWAY_Y,
                      row.axis === 'X' ? rZ + 0.25 : rZ + 0.15
                    ]}>
                      <boxGeometry args={[
                        row.axis === 'X' ? 0.04 : 0.2,
                        0.04,
                        row.axis === 'X' ? 0.2 : 0.04
                      ]} />
                      <meshStandardMaterial color="#1e3a8a" metalness={0.7} />
                    </mesh>
                    
                    {/* Vertical conduit drop whip down to the top of the cabinet */}
                    <mesh position={[
                      row.axis === 'X' ? rX + 0.15 : rX + 0.35,
                      (BUSWAY_Y + RACK_HEIGHT) / 2,
                      row.axis === 'X' ? rZ + 0.35 : rZ + 0.15
                    ]}>
                      <boxGeometry args={[0.03, BUSWAY_Y - RACK_HEIGHT, 0.03]} />
                      <meshStandardMaterial color="#1d4ed8" metalness={0.8} roughness={0.2} />
                      <Edges color="#172554" />
                    </mesh>

                    {/* Entrance junction box on the top of the rack */}
                    <mesh position={[
                      row.axis === 'X' ? rX + 0.15 : rX + 0.35,
                      RACK_HEIGHT + 0.03,
                      row.axis === 'X' ? rZ + 0.35 : rZ + 0.15
                    ]}>
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
      })}
    </group>
  )
}
