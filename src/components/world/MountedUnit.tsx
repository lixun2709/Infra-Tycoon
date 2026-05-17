import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useInfraStore } from '../../store/useInfraStore'
import type { InfraNode } from '../../store/infraTypes'
import { HARDWARE_CATALOG, type HardwareCatalogSpec } from '../../physics/hardwareLibrary'
import { RACK_HEIGHT, U_WORLD } from '../../physics/dimensions'
import { PortVisuals, StorageBar, PIIShield, MaintenanceIcon, InternalHardware, ServiceHolograms } from './renderers/HardwareRenderer'

interface MountedUnitProps {
  node: InfraNode
  isSelected: boolean
}

const TYPE_ACCENT: Record<string, string> = {
  compute: '#4a5568',
  storage: '#2b6cb0',
  backup: '#805ad5',
  network: '#2d3748',
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
  
  const groupRef = useRef<THREE.Group>(null)
  const isDecommissioning = node.provisioningState === 'decommissioning'
  
  // Use lazy state initialization to keep render pure
  const [isBrandNew] = useState(() => {
    return node.provisioningState === 'racked' && (Date.now() - (node.installTimestamp || 0) < 10000)
  })
  
  const isSeatedInitial = !isBrandNew && !isDecommissioning
  const isSeated = useRef(isSeatedInitial)
  const progress = useRef(isSeatedInitial ? 1 : 0)

  useEffect(() => {
    if (isDecommissioning) {
      isSeated.current = false
      progress.current = 1
    }
  }, [isDecommissioning])
  
  useFrame((_, delta) => {
    if (!groupRef.current || node.slotIndex == null || node.parentRackId == null) return

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

  const isAnyNodeSelected = !!selectedNodeId
  const spec = (node.catalogKey ? HARDWARE_CATALOG[node.catalogKey] : null) as HardwareCatalogSpec | null
  const color = spec ? spec.color : (TYPE_ACCENT[node.type] ?? '#718096')

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)
  const opacity = isSelected ? 0.15 : (isAnyNodeSelected ? 0.4 : 1.0)

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

export const MountedUnit = (MountedUnitComponent)
