import React, { useRef } from 'react'
import * as THREE from 'three'
import { Line, Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useInfraStore, type Connection } from '../../store/useInfraStore'
import { CLOUD_GATEWAY_POS } from './Scene'

const RACK_HEIGHT = 2.1
const U_WORLD = RACK_HEIGHT / 42

function getPortWorldPosition(node: any, nodes: any[]) {
    if (!node.parentRackId) return new THREE.Vector3(node.position.x, node.position.y, node.position.z)
    const rack = nodes.find(n => n.id === node.parentRackId)
    if (!rack) return new THREE.Vector3(node.position.x, node.position.y, node.position.z)

    const yOffset = -RACK_HEIGHT / 2 + U_WORLD * (node.slotIndex - 1 + node.uHeight / 2)

    return new THREE.Vector3(
        rack.position.x,
        rack.position.y + RACK_HEIGHT / 2 + yOffset,
        rack.position.z - 0.41 // Flush with back of hardware
    )
}

const WAN_GATEWAY_POS = new THREE.Vector3(0, 10, -15)

function getWanCurve(portPos: THREE.Vector3, isIncoming: boolean) {
    const backOfRack = new THREE.Vector3(portPos.x, portPos.y + 0.5, portPos.z - 2)
    const ceiling = new THREE.Vector3(portPos.x * 0.5, 12, -8)
    
    const pts = [portPos, backOfRack, ceiling, WAN_GATEWAY_POS]
    if (isIncoming) pts.reverse()
    
    return new THREE.CatmullRomCurve3(pts)
}

function LockIcon({ pos }: { pos: THREE.Vector3 }) {
    return (
        <group position={pos}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.08, 0.08, 0.08]} />
                <meshStandardMaterial color="#4b5563" metalness={0.8} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
                <torusGeometry args={[0.04, 0.01, 8, 12, Math.PI]} />
                <meshStandardMaterial color="#4b5563" />
            </mesh>
        </group>
    )
}

function AnimatedCable({ conn, points, isWan, isVirtual, isCloud, isQuarantined, isMigration, isGlobal, isBlocked }: { conn?: Connection, points: THREE.Vector3[], isWan?: boolean, isVirtual?: boolean, isCloud?: boolean, isQuarantined?: boolean, isMigration?: boolean, isGlobal?: boolean, isBlocked?: boolean }) {
    const lineRef = useRef<any>(null)
    const [hovered, setHovered] = React.useState(false)
    
    const nodes = useInfraStore(s => s.nodes)
    const startNode = conn ? nodes.find(n => n.id === conn.startNodeId) : null
    const endNode = conn ? nodes.find(n => n.id === conn.endNodeId) : null
    const startPort = startNode?.ports.find(p => p.id === conn?.startPortId)
    const endPort = endNode?.ports.find(p => p.id === conn?.endPortId)

    // L3 Validation: Pulse only if ports are UP and in same subnet
    const isSameSubnet = !!(startPort?.ip && endPort?.ip && startPort.ip.split('.').slice(0, 3).join('.') === endPort.ip.split('.').slice(0, 3).join('.'))
    
    const L1_UP = startPort?.status === 'up' && endPort?.status === 'up'
    const L3_UP = L1_UP && isSameSubnet
    
    let color = '#ef4444' // Red (Disconnected/Down)
    if (L3_UP) {
        color = '#22c55e' // Bright Green (Active L3)
    } else if (L1_UP) {
        color = '#94a3b8' // Grey (L1/L2 Active but no L3)
    } else if (startPort?.status === 'up' || endPort?.status === 'up') {
        color = '#ef4444' // Red (Cable plugged but one end is shut)
    }

    if (isWan) color = L3_UP ? '#a855f7' : '#94a3b8'
    if (isVirtual) color = '#ed8936'
    if (isCloud) color = '#38bdf8'
    if (isQuarantined) color = '#ef4444'
    if (isMigration) color = '#ffffff'
    if (isGlobal) color = L3_UP ? '#c9a032' : '#94a3b8'
    if (isBlocked) color = '#4b5563'

    const lineWidth = isGlobal ? 8 : isMigration ? 6 : isCloud ? 5 : isWan ? 6 : (isVirtual ? 4 : (conn && conn.latencyMs > 10 ? 5 : 4))

    const isFlowing = L3_UP || isMigration || isCloud || (isWan && L3_UP)

    useFrame(() => {
        if (lineRef.current && isFlowing) {
            lineRef.current.material.dashOffset -= 0.01
        }
    })

    return (
        <group 
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={() => setHovered(false)}
        >
            <Line
                ref={lineRef}
                points={points}
                color={color}
                lineWidth={lineWidth}
                transparent
                opacity={isBlocked ? 0.3 : 0.9}
                dashed={isFlowing}
                dashSize={0.2}
                gapSize={0.1}
            />
            {hovered && conn && (
                <Html position={points[Math.floor(points.length / 2)]}>
                    <div className="pointer-events-none bg-slate-950/90 border border-teal-500/50 p-2 rounded shadow-2xl text-[10px] font-mono text-teal-400 whitespace-nowrap backdrop-blur-sm">
                        <p className="font-black mb-1 text-white border-b border-white/10 pb-1">Logical Link Status</p>
                        <p>Status: <span className={L3_UP ? 'text-green-400' : 'text-amber-400'}>{L3_UP ? 'ACTIVE (L3)' : 'LINK ONLY'}</span></p>
                        <p>{startNode?.name}:{startPort?.label} {'<->'} {endNode?.name}:{endPort?.label}</p>
                        {!L3_UP && <p className="mt-1 text-red-400 text-[8px] font-black uppercase">Subnet Mismatch or Interface Down</p>}
                    </div>
                </Html>
            )}
            {isBlocked && (
                <LockIcon pos={points[Math.floor(points.length / 2)]} />
            )}
        </group>
    )
}

function GhostCable() {
    const { connectingPort, nodes, currentSiteId, mousePosition } = useInfraStore()

    if (!connectingPort || !mousePosition) return null

    const startNode = nodes.find(n => n.id === connectingPort.nodeId)
    if (!startNode) return null

    const isWan = startNode.siteId !== currentSiteId
    let startPos = getPortWorldPosition(startNode, nodes)
    const endPos = new THREE.Vector3(mousePosition.x, mousePosition.y, mousePosition.z)

    if (!isWan && startPos.distanceTo(endPos) < 0.01) {
        endPos.x += 0.01
    }

    let curve
    if (isWan) {
        // Ghost cable is coming from the remote site to the local mouse position
        curve = getWanCurve(endPos, true)
    } else {
        const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
        midPoint.y -= Math.min(0.5, startPos.distanceTo(endPos) * 0.2)
        midPoint.x += 0.15
        curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos])
    }
    
    const points = curve.getPoints(isWan ? 24 : 24)

    return <AnimatedCable points={points} isWan={isWan} />
}

function PointerTracker() {
    const { pointer, raycaster, camera } = useThree()
    const setMousePosition = useInfraStore(s => s.setMousePosition)
    const cableMode = useInfraStore(s => s.cableMode)

    useFrame(() => {
        if (!cableMode) return
        raycaster.setFromCamera(pointer, camera)
        // Intersect with a horizontal plane at Y=1 (middle of racks)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1)
        const target = new THREE.Vector3()
        raycaster.ray.intersectPlane(plane, target)
        if (target) {
             setMousePosition(target)
        }
    })
    return null
}

export function Cables() {
    const { connections, nodes, currentSiteId, cloudLinks } = useInfraStore()

    return (
        <group>
            <PointerTracker />
            
            {connections.map((conn) => {
                const startNode = nodes.find(n => n.id === conn.startNodeId)
                const endNode = nodes.find(n => n.id === conn.endNodeId)

                if (!startNode || !endNode) return null

                // Render if AT LEAST ONE node is in the current site (Logical OR)
                if (startNode.siteId !== currentSiteId && endNode.siteId !== currentSiteId) return null

                const isWan = startNode.siteId !== endNode.siteId
                let curve
                
                if (isWan) {
                    const isStartLocal = startNode.siteId === currentSiteId
                    const localNode = isStartLocal ? startNode : endNode
                    const portPos = getPortWorldPosition(localNode, nodes)
                    
                    curve = getWanCurve(portPos, !isStartLocal)
                } else {
                    const startPos = getPortWorldPosition(startNode, nodes)
                    const endPos = getPortWorldPosition(endNode, nodes)

                    if (startPos.distanceTo(endPos) < 0.01) {
                        endPos.x += 0.01
                    }

                    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
                    const isSameRack = startNode.parentRackId === endNode.parentRackId
                    if (isSameRack) {
                        midPoint.z -= 0.2 // Bow slightly backward into the rear aisle space
                    } else {
                        midPoint.y -= Math.min(0.5, startPos.distanceTo(endPos) * 0.2)
                    }
                    curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos])
                }
                
                const points = curve.getPoints(24)
                const isGlobal = startNode.siteId !== endNode.siteId
                const isBlocked = conn.status === 'blocked' || conn.isBlockedByCompliance

                return <AnimatedCable key={conn.id} conn={conn} points={points} isWan={isWan} isQuarantined={startNode.isInfected || endNode.isInfected} isGlobal={isGlobal} isBlocked={isBlocked} />
            })}

            {nodes.filter(n => n.type === 'load_balancer' && n.siteId === currentSiteId && n.healthStatus !== 'critical').map(lb => {
                const healthyComputes = nodes.filter(n => 
                    n.type === 'compute' && 
                    n.siteId === currentSiteId && 
                    (n.status === 'online' || n.healthStatus === 'healthy' || !n.healthStatus)
                )
                const lbPos = getPortWorldPosition(lb, nodes)
                
                return healthyComputes.map(comp => {
                    const compPos = getPortWorldPosition(comp, nodes)
                    
                    if (lbPos.distanceTo(compPos) < 0.01) {
                        compPos.x += 0.01
                    }

                    const midPoint = new THREE.Vector3().addVectors(lbPos, compPos).multiplyScalar(0.5)
                    midPoint.y += 0.2
                    const curve = new THREE.CatmullRomCurve3([lbPos, midPoint, compPos])
                    const points = curve.getPoints(12)

                    return <AnimatedCable key={`lb-${lb.id}-${comp.id}`} points={points} isVirtual />
                })
            })}

            {/* Cloud Tiering Links */}
            {cloudLinks.map(cl => {
                const node = nodes.find(n => n.id === cl.nodeId)
                if (!node || node.siteId !== currentSiteId) return null
                
                const portPos = getPortWorldPosition(node, nodes)
                const midUp = new THREE.Vector3(portPos.x + 3, portPos.y + 4, portPos.z)
                const approach = new THREE.Vector3(CLOUD_GATEWAY_POS.x - 2, CLOUD_GATEWAY_POS.y + 1, CLOUD_GATEWAY_POS.z)
                
                const curve = new THREE.CatmullRomCurve3([portPos, midUp, approach, CLOUD_GATEWAY_POS])
                const pts = curve.getPoints(32)

                return <AnimatedCable key={`cloud-${cl.id}`} points={pts} isCloud />
            })}

            {/* AI Migration Cables */}
            {nodes.filter(n => n.activeMigration && n.siteId === currentSiteId).map(sourceNode => {
                const targetNode = nodes.find(n => n.id === sourceNode.activeMigration!.targetNodeId)
                if (!targetNode) return null
                
                const srcPos = getPortWorldPosition(sourceNode, nodes)
                const tgtPos = getPortWorldPosition(targetNode, nodes)
                const midPoint = new THREE.Vector3().addVectors(srcPos, tgtPos).multiplyScalar(0.5)
                midPoint.y += 1.2
                
                const curve = new THREE.CatmullRomCurve3([srcPos, midPoint, tgtPos])
                const pts = curve.getPoints(20)

                return <AnimatedCable key={`migration-${sourceNode.id}`} points={pts} isMigration />
            })}

            <GhostCable />
        </group>
    )
}