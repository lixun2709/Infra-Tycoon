import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useInfraStore } from '../../store/useInfraStore'
import type { InfraNode } from '../../store/infraTypes'
import { HARDWARE_CATALOG, type HardwareCatalogSpec } from '../../physics/hardwareLibrary'
import { RACK_HEIGHT, U_WORLD } from '../../physics/dimensions'
import { 
  PortVisuals, 
  PortVisualsSimplified, 
  StorageBar, 
  PIIShield, 
  MaintenanceIcon, 
  InternalHardware, 
  ServiceHolograms 
} from './renderers/HardwareRenderer'

interface MountedUnitProps {
  node: InfraNode
  isSelected: boolean
}

const TYPE_ACCENT: Record<string, string> = {
  compute: '#10b981',
  storage: '#2563eb',
  backup: '#8b5cf6',
  network: '#f97316',
}

function rackHardwareCenterY(slotIndex: number, uHeight: number): number {
  return -RACK_HEIGHT / 2 + U_WORLD * (slotIndex - 1 + uHeight / 2)
}

// Global Cached Resources
const chassisGeometry = new THREE.BoxGeometry(0.92, 1, 0.9)

import { useInteractable } from '../../hooks/useInteraction'

function MountedUnitComponent({ node, isSelected }: MountedUnitProps) {
  const updateNode = useInfraStore(s => s.updateNode)
  const finalRemoveNode = useInfraStore(s => s.finalRemoveNode)
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  const nodes = useInfraStore(s => s.nodes)
  const renderQuality = useInfraStore(s => s.renderQuality)
  
  const groupRef = useRef<THREE.Group>(null)
  const isDecommissioning = node.provisioningState === 'decommissioning'
  
  // LOD level state: 0 = High, 1 = Medium, 2 = Low
  const [lod, setLod] = useState<0 | 1 | 2>(0)
  
  // Use lazy state initialization to keep render pure
  const [isBrandNew] = useState(() => {
    return node.provisioningState === 'racked' && (Date.now() - (node.installTimestamp || 0) < 10000)
  })
  
  const isSeatedInitial = !isBrandNew && !isDecommissioning
  const isSeated = useRef(isSeatedInitial)
  const progress = useRef(isSeatedInitial ? 1 : 0)
  const frameCounter = useRef(0)

  useEffect(() => {
    if (isDecommissioning) {
      isSeated.current = false
      progress.current = 1
    }
  }, [isDecommissioning])
  
  useFrame((state, delta) => {
    if (!groupRef.current || node.slotIndex == null || node.parentRackId == null) return

    // Throttled Level-of-Detail Check (runs once every 15 frames to reduce overhead)
    frameCounter.current++
    if (frameCounter.current % 15 === 0) {
      let targetLod: 0 | 1 | 2 = 0
      if (renderQuality === 'ultra') {
        targetLod = 0
      } else if (renderQuality === 'low') {
        targetLod = 2
      } else {
        // 'auto' mode: calculate dynamic distance between active camera and server node
        const worldPos = new THREE.Vector3()
        groupRef.current.getWorldPosition(worldPos)
        const dist = state.camera.position.distanceTo(worldPos)
        if (dist >= 18) {
          targetLod = 2
        } else if (dist >= 7.5) {
          targetLod = 1
        } else {
          targetLod = 0
        }
      }
      if (lod !== targetLod) {
        setLod(targetLod)
      }
    }

    if (isDecommissioning) {
      progress.current -= delta * 0.15 
      const t = Math.max(0, progress.current)
      groupRef.current.position.z = -1.2 * (1 - t)
      if (t <= 0) finalRemoveNode(node.id)
      return
    }

    if (!isSeated.current) {
      progress.current += delta * 0.125 
      const t = Math.min(1, progress.current)
      groupRef.current.position.z = -1.2 * (1 - t)
      if (t >= 1) {
        groupRef.current.position.z = 0
        isSeated.current = true
        updateNode(node.id, { provisioningState: 'bootstrapped' })
      }
    }
  })

  const { isHovered, interactionProps } = useInteractable(node.id, 'NODE')

  if (node.slotIndex == null || node.parentRackId == null) return null

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null
  const isAnyHardwareSelected = selectedNode ? selectedNode.type !== 'rack' : false
  const spec = (node.catalogKey ? HARDWARE_CATALOG[node.catalogKey] : null) as HardwareCatalogSpec | null
  const color = spec ? spec.color : (TYPE_ACCENT[node.type] ?? '#718096')

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)
  const opacity = isSelected ? 0.15 : (isAnyHardwareSelected ? 0.4 : 1.0)

  // LOD Tier 2 (Low Detail) renders a bare chassis mesh with zero sub-geometries or lights
  if (lod === 2 && !isSelected) {
    return (
      <group ref={groupRef} position={[0, y, isBrandNew || isDecommissioning ? -1.2 : 0]}>
        <mesh geometry={chassisGeometry} scale={[1, h, 1]} {...interactionProps}>
          <meshStandardMaterial
            color={node.isInfected ? '#4a044e' : color}
            metalness={0.2}
            roughness={0.8}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      </group>
    )
  }

  // LOD Tier 1 (Medium Detail) renders flat bezel panels with simplified status LED and text name
  if (lod === 1 && !isSelected) {
    return (
      <group ref={groupRef} position={[0, y, isBrandNew || isDecommissioning ? -1.2 : 0]}>
        <mesh geometry={chassisGeometry} scale={[1, h, 1]} {...interactionProps}>
          <meshStandardMaterial
            color={node.isInfected ? '#4a044e' : color}
            metalness={0.3}
            roughness={0.6}
            transparent={opacity < 1}
            opacity={opacity}
          />
          <Edges color={isHovered ? '#48afbb' : '#f7fafc'} threshold={20} lineWidth={1.5} />
        </mesh>
        
        <PortVisualsSimplified node={node} h={h} />

        <Text position={[0, 0, 0.485]} fontSize={0.025} color="#ffffff" outlineWidth={0.005} outlineColor="#000000">
          {node.name}
        </Text>
      </group>
    )
  }

  // LOD Tier 0 (High Detail) renders full ports, storage bars, PII shields, heatsinks, cooling fans, and holograms
  return (
    <group ref={groupRef} position={[0, y, isBrandNew || isDecommissioning ? -1.2 : 0]}>
      <mesh geometry={chassisGeometry} scale={[1, h, 1]} {...interactionProps}>
        <meshStandardMaterial
          color={node.isInfected ? '#4a044e' : color}
          metalness={0.4}
          roughness={0.4}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={!isSelected}
        />
        <Edges color={isSelected ? '#00f2ff' : (isHovered ? '#48afbb' : '#f7fafc')} threshold={20} lineWidth={isSelected || isHovered ? 3 : 1} />
      </mesh>
      
      {/* Front Panel Features */}
      <PortVisuals node={node} h={h} />
      
      {node.type === 'storage' && node.totalStorageTB && (
        <StorageBar used={node.usedStorageTB || 0} total={node.totalStorageTB} color={color} h={h} />
      )}

      {node.dataCategory === 'PII' && <PIIShield h={h} />}
      {node.provisioningState === 'decommissioning' && <MaintenanceIcon />}

      {/* Internal Modules (Visible when node is selected/transparent) */}
      {isSelected && <InternalHardware node={node} h={h} />}
      
      {/* Service Holograms */}
      <ServiceHolograms node={node} />

      <Text position={[0, 0, 0.485]} fontSize={0.025} color="#ffffff" outlineWidth={0.005} outlineColor="#000000">
        {node.name}
      </Text>
    </group>
  )
}

// Deep structural React.memo comparator to avoid unneeded virtual DOM cascades
export const MountedUnit = React.memo(MountedUnitComponent, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.type === nextProps.node.type &&
    prevProps.node.provisioningState === nextProps.node.provisioningState &&
    prevProps.node.systemState === nextProps.node.systemState &&
    prevProps.node.degradation === nextProps.node.degradation &&
    prevProps.node.slotIndex === nextProps.node.slotIndex &&
    prevProps.node.parentRackId === nextProps.node.parentRackId &&
    prevProps.node.isInfected === nextProps.node.isInfected &&
    prevProps.node.usedStorageTB === nextProps.node.usedStorageTB &&
    prevProps.node.totalStorageTB === nextProps.node.totalStorageTB &&
    prevProps.node.dataCategory === nextProps.node.dataCategory &&
    prevProps.node.ports.length === nextProps.node.ports.length &&
    prevProps.node.ports.every((p, idx) => {
      const nextPort = nextProps.node.ports[idx]
      return nextPort && p.connectedTo === nextPort.connectedTo && p.status === nextPort.status
    })
  )
})
