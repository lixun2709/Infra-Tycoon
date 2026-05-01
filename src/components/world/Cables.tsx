import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
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
        rack.position.z + 0.45 // Cables sit slightly in front of the rack face
    )
}

function AnimatedCable({ conn, points }: { conn: Connection, points: THREE.Vector3[] }) {
    const lineRef = useRef<any>(null)
    
    const isHighLatency = conn.latencyMs > 10
    const color = isHighLatency ? '#f59e0b' : '#2dd4bf' // amber if > 10ms, otherwise teal
    
    // Higher bandwidth = faster animation
    const speed = conn.bandwidthGbps > 50 ? 0.05 : 0.02

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
            lineWidth={isHighLatency ? 2.5 : 1.5}
            transparent
            opacity={0.8}
            dashed
            dashSize={0.2}
            dashScale={1}
            gapSize={0.1}
        />
    )
}

export function Cables() {
    const { connections, nodes } = useInfraStore()

    return (
        <group>
            {connections.map((conn) => {
                const startNode = nodes.find(n => n.id === conn.startNodeId)
                const endNode = nodes.find(n => n.id === conn.endNodeId)

                if (!startNode || !endNode) return null

                const startPos = getPortWorldPosition(startNode, nodes)
                const endPos = getPortWorldPosition(endNode, nodes)

                // Create a sagging effect
                const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5)
                midPoint.y -= Math.min(0.5, startPos.distanceTo(endPos) * 0.2) // Deeper sag for longer cables

                const curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos])
                const points = curve.getPoints(24)

                return <AnimatedCable key={conn.id} conn={conn} points={points} />
            })}
        </group>
    )
}