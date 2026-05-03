import React, { useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
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
        rack.position.z + 0.45
    )
}

const WAN_GATEWAY_POS = new THREE.Vector3(0, 10, -15)

function getWanCurve(portPos: THREE.Vector3, isIncoming: boolean) {
    const backOfRack = new THREE.Vector3(portPos.x, portPos.y + 0.5, portPos.z - 1)
    const ceiling = new THREE.Vector3(portPos.x * 0.5, 9, -5)
    
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
    const secondaryRef = useRef<any>(null)
    
    let color = '#2dd4bf'
    if (conn && conn.latencyMs > 10) color = '#f59e0b'
    if (isWan) color = '#a855f7' // Purple for WAN
    if (isVirtual) color = '#ed8936' // Orange for VIP
    if (isCloud) color = '#38bdf8' // Sky blue for Cloud
    if (isQuarantined) color = '#ef4444' // Bright red for quarantined
    if (isMigration) color = '#ffffff' // White for vMotion
    if (isGlobal) color = '#c9a032' // Gold for Inter-continental
    if (isBlocked) color = '#4b5563' // Dark grey for blocked

    const networkLoad = useInfraStore(s => s.networkLoad)
    const baseSpeed = isMigration ? 0.15 : isVirtual ? 0.05 : (conn && conn.bandwidthGbps > 50 ? 0.05 : 0.02)
    // Map latency inversely to speed (lower latency = faster animation)
    const latencyMultiplier = conn ? Math.max(0.1, Math.min(2.0, 30 / conn.latencyMs)) : 1
    const speed = baseSpeed * latencyMultiplier * (networkLoad * 5)

    useFrame(() => {
        if (lineRef.current && lineRef.current.material && !isQuarantined && !isBlocked) {
            lineRef.current.material.dashOffset -= speed
        }
        if (secondaryRef.current && secondaryRef.current.material && !isQuarantined && !isBlocked) {
            secondaryRef.current.material.dashOffset -= speed * 1.5 // Double pulse effect
        }
    })

    return (
        <group>
            <Line
                ref={lineRef}
                points={points}
                color={color}
                lineWidth={isGlobal ? 4 : isMigration ? 3 : isCloud ? 2.5 : isWan ? 3 : (isVirtual ? 2 : (conn && conn.latencyMs > 10 ? 2.5 : 1.5))}
                transparent
                opacity={isBlocked ? 0.3 : (isGlobal ? 0.9 : isMigration ? 0.95 : isVirtual ? 0.8 : 0.8)}
                dashed
                dashSize={isGlobal ? 0.4 : isMigration ? 0.1 : 0.2}
                dashScale={1}
                gapSize={0.1}
            />
            {isGlobal && (
                <Line
                    ref={secondaryRef}
                    points={points}
                    color="#ffffff"
                    lineWidth={1.5}
                    transparent
                    opacity={0.6}
                    dashed
                    dashSize={0.1}
                    dashScale={1}
                    gapSize={0.8}
                />
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
                    midPoint.y -= Math.min(0.5, startPos.distanceTo(endPos) * 0.2)
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