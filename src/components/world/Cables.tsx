import React, { useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useInfraStore, type Connection } from '../../store/useInfraStore'

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

function AnimatedCable({ conn, points, isWan, isVirtual }: { conn?: Connection, points: THREE.Vector3[], isWan?: boolean, isVirtual?: boolean }) {
    const lineRef = useRef<any>(null)
    
    let color = '#2dd4bf'
    if (conn && conn.latencyMs > 10) color = '#f59e0b'
    if (isWan) color = '#a855f7' // Purple for WAN
    if (isVirtual) color = '#ed8936' // Orange for VIP

    const speed = isVirtual ? 0.05 : (conn && conn.bandwidthGbps > 50 ? 0.05 : 0.02)

    useFrame(() => {
        if (lineRef.current && lineRef.current.material) {
            lineRef.current.material.dashOffset -= speed
        }
    })

    return (
        <Line
            ref={lineRef}
            points={points}
            color={color}
            lineWidth={isWan ? 3 : (isVirtual ? 2 : (conn && conn.latencyMs > 10 ? 2.5 : 1.5))}
            transparent
            opacity={isVirtual ? 0.8 : 0.8}
            dashed
            dashSize={0.2}
            dashScale={1}
            gapSize={0.1}
        />
    )
}

function GhostCable() {
    const { connectingPort, nodes, currentSiteId, mousePosition } = useInfraStore()

    if (!connectingPort || !mousePosition) return null

    const startNode = nodes.find(n => n.id === connectingPort.nodeId)
    if (!startNode) return null

    const isWan = startNode.siteId !== currentSiteId
    let startPos = getPortWorldPosition(startNode, nodes)

    if (isWan) {
        // Drop straight down from the sky
        startPos = new THREE.Vector3(mousePosition.x, 15, mousePosition.z)
    }

    const endPos = new THREE.Vector3(mousePosition.x, mousePosition.y, mousePosition.z)

    if (!isWan && startPos.distanceTo(endPos) < 0.01) {
        endPos.x += 0.01
    }

    let curve
    if (isWan) {
        curve = new THREE.LineCurve3(startPos, endPos)
    } else {
        const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
        midPoint.y -= Math.min(0.5, startPos.distanceTo(endPos) * 0.2)
        curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos])
    }
    
    const points = curve.getPoints(isWan ? 2 : 24)

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
    const { connections, nodes, currentSiteId } = useInfraStore()

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
                let startPos, endPos
                
                if (isWan) {
                    const visibleNode = startNode.siteId === currentSiteId ? startNode : endNode
                    startPos = getPortWorldPosition(visibleNode, nodes)
                    // Map to vertical coordinate directly above the local rack at Y=15
                    endPos = new THREE.Vector3(startPos.x, 15, startPos.z)
                } else {
                    startPos = getPortWorldPosition(startNode, nodes)
                    endPos = getPortWorldPosition(endNode, nodes)
                }

                if (!isWan && startPos.distanceTo(endPos) < 0.01) {
                    endPos.x += 0.01
                }

                let curve
                if (isWan) {
                    curve = new THREE.LineCurve3(startPos, endPos)
                } else {
                    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
                    midPoint.y -= Math.min(0.5, startPos.distanceTo(endPos) * 0.2)
                    curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos])
                }
                
                const points = curve.getPoints(isWan ? 2 : 24)

                return <AnimatedCable key={conn.id} conn={conn} points={points} isWan={isWan} />
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

            <GhostCable />
        </group>
    )
}