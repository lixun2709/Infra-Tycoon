import { useMemo } from 'react'
import * as THREE from 'three'
import { APPLICATION_CATALOG } from '../../../physics/applicationLibrary'
import type { InfraNode } from '../../../store/infraTypes'
import { useInfraStore } from '../../../store/useInfraStore'

const RACK_HEIGHT = 2.1

export function DataThread({ start, end, color }: { start: THREE.Vector3; end: THREE.Vector3; color: string }) {
  const curve = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
    mid.y += 1.5
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [start, end])

  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.005, 8, false]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  )
}

export function DataThreads() {
  const nodes = useInfraStore(s => s.nodes)
  const applications = useInfraStore(s => s.applications)
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)

  const threads = useMemo(() => {
    if (!selectedNodeId) return []
    const selectedApps = applications.filter((a: any) => a.nodeId === selectedNodeId)
    
    const links: Array<{ start: THREE.Vector3; end: THREE.Vector3; color: string }> = []
    
    selectedApps.forEach((app: any) => {
      const appInfo = APPLICATION_CATALOG[app.appId]
      if (!appInfo) return

      if (appInfo.category === 'web') {
        const dbApps = applications.filter((a: any) => APPLICATION_CATALOG[a.appId]?.category === 'database')
        dbApps.forEach((dbApp: any) => {
          const startNode = nodes.find((n: any) => n.id === app.nodeId)
          const endNode = nodes.find((n: any) => n.id === dbApp.nodeId)
          if (startNode && endNode && startNode.id !== endNode.id) {
            const getPos = (n: InfraNode) => {
              const p = n.position.clone()
              if (n.parentRackId) {
                const rack = nodes.find((rk: any) => rk.id === n.parentRackId)
                if (rack) {
                   const yOffset = -RACK_HEIGHT / 2 + (RACK_HEIGHT / 42) * ((n.slotIndex ?? 1) - 1 + n.uHeight / 2)
                   p.set(rack.position.x, rack.position.y + RACK_HEIGHT / 2 + yOffset, rack.position.z)
                }
              }
              return p
            }
            links.push({
              start: getPos(startNode),
              end: getPos(endNode),
              color: appInfo.color
            })
          }
        })
      }
    })
    return links
  }, [selectedNodeId, applications, nodes])

  return (
    <group>
      {threads.map((link, i) => (
        <DataThread key={i} start={link.start} end={link.end} color={link.color} />
      ))}
    </group>
  )
}
