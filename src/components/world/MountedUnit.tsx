import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Text, Detailed } from '@react-three/drei'
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
  InternalHardware 
} from './renderers/HardwareRenderer'
import { AirflowVisualizer } from './AirflowVisualizer'

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
  
  const groupRef = useRef<THREE.Object3D>(null)
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
  
  useFrame((_state, delta) => {
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

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null
  const isAnyHardwareSelected = selectedNode ? selectedNode.type !== 'rack' : false
  const spec = (node.catalogKey ? HARDWARE_CATALOG[node.catalogKey] : null) as HardwareCatalogSpec | null
  const color = spec ? spec.color : (TYPE_ACCENT[node.type] ?? '#718096')

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)
  const opacity = isSelected ? 0.15 : (isAnyHardwareSelected ? 0.4 : 1.0)

  // LOD Tier 2 (Low Detail) renders a bare chassis mesh with zero sub-geometries or lights
  const renderTier2 = () => (
    <mesh geometry={chassisGeometry} scale={[1, h, 1]} {...interactionProps}>
      <meshStandardMaterial
        color={node.isInfected ? '#4a044e' : color}
        metalness={0.2}
        roughness={0.8}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )

  // LOD Tier 1 (Medium Detail) renders flat bezel panels with simplified status LED and text name
  const renderTier1 = () => (
    <group>
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

      <AirflowVisualizer node={node} h={h} />

      <Text position={[0, 0, 0.485]} fontSize={0.025} color="#ffffff" outlineWidth={0.005} outlineColor="#000000">
        {node.name}
      </Text>
    </group>
  )

  // LOD Tier 0 (High Detail) renders full ports, storage bars, PII shields, heatsinks, cooling fans, and holograms
  const renderTier0 = () => (
    <group>
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

      <AirflowVisualizer node={node} h={h} />

      <Text position={[0, 0, 0.485]} fontSize={0.025} color="#ffffff" outlineWidth={0.005} outlineColor="#000000">
        {node.name}
      </Text>
    </group>
  )

  // Forced Ultra Quality renders high-detail only
  if (renderQuality === 'ultra') {
    return (
      <group ref={groupRef} position={[0, y, isBrandNew || isDecommissioning ? -1.2 : 0]}>
        {renderTier0()}
      </group>
    )
  }

  // Forced Low Quality renders low-detail only (when not selected)
  if (renderQuality === 'low' && !isSelected) {
    return (
      <group ref={groupRef} position={[0, y, isBrandNew || isDecommissioning ? -1.2 : 0]}>
        {renderTier2()}
      </group>
    )
  }

  // Auto Quality or Forced-Low-With-Selected uses WebGL-native THREE.LOD to shift tiers with zero React states (Day 30)
  return (
    <Detailed distances={[0, 7.5, 18]} ref={groupRef as React.Ref<THREE.LOD>} position={[0, y, isBrandNew || isDecommissioning ? -1.2 : 0]}>
      {/* Tier 0 (High) from distance 0 to 7.5 */}
      {renderTier0()}

      {/* Tier 1 (Medium) from distance 7.5 to 18 */}
      {renderTier1()}

      {/* Tier 2 (Low) from distance 18+ */}
      {renderTier2()}
    </Detailed>
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
    prevProps.node.temperature === nextProps.node.temperature &&
    prevProps.node.wattage === nextProps.node.wattage &&
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
