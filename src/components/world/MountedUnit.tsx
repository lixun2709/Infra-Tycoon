import React, { useState, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges, Text } from '@react-three/drei'
import { useInfraStore, type InfraNode } from '../../store/useInfraStore'
import { HARDWARE_CATALOG } from '../../physics/hardwareLibrary'
import { RACK_HEIGHT, U_WORLD } from '../../physics/dimensions'
import { PortVisuals, StorageBar, PIIShield, MaintenanceIcon, InternalHardware, ServiceHolograms } from './renderers/HardwareRenderer'

interface MountedUnitProps {
  node: InfraNode
  isSelected: boolean
  onSelect: (id: string) => void
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

function MountedUnitComponent({ node, isSelected, onSelect }: MountedUnitProps) {
  if (node.slotIndex == null || node.parentRackId == null) return null

  const updateNode = useInfraStore(s => s.updateNode)
  const finalRemoveNode = useInfraStore(s => s.finalRemoveNode)
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  
  const isDecommissioning = node.provisioningState === 'decommissioning'
  const isBrandNew = node.provisioningState === 'racked' && (Date.now() - (node.installTimestamp || 0) < 10000)
  
  const [isSeated, setIsSeated] = useState(!isBrandNew && !isDecommissioning)
  const progress = useRef(isSeated ? 1 : 0)
  const zOffset = useRef(isSeated ? 0 : -1.2)

  useEffect(() => {
    if (isDecommissioning) {
      setIsSeated(false)
      progress.current = 1
    }
  }, [isDecommissioning])
  
  useFrame((_, delta) => {
    if (isDecommissioning) {
      progress.current -= delta * 0.15 
      const t = Math.max(0, progress.current)
      zOffset.current = -1.2 * (1 - t)
      if (t <= 0) finalRemoveNode(node.id)
      return
    }

    if (!isSeated) {
      progress.current += delta * 0.125 
      const t = Math.min(1, progress.current)
      zOffset.current = -1.2 * (1 - t)
      if (t >= 1) {
        zOffset.current = 0
        setIsSeated(true)
        updateNode(node.id, { provisioningState: 'bootstrapped' })
      }
    }
  })

  const isAnyNodeSelected = !!selectedNodeId
  const color = (node.catalogKey != null && HARDWARE_CATALOG[node.catalogKey]) 
    ? HARDWARE_CATALOG[node.catalogKey].color 
    : TYPE_ACCENT[node.type] ?? '#718096'

  const h = node.uHeight * U_WORLD
  const y = rackHardwareCenterY(node.slotIndex, node.uHeight)
  const opacity = isSelected ? 0.15 : (isAnyNodeSelected ? 0.4 : 1.0)

  return (
    <group position={[0, y, zOffset.current]}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}>
        <boxGeometry args={[0.92, h, 0.9]} />
        <meshStandardMaterial
          color={node.isInfected ? '#4a044e' : color}
          metalness={0.4}
          roughness={0.4}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={!isSelected}
        />
        <Edges color={isSelected ? '#00f2ff' : '#f7fafc'} threshold={20} lineWidth={isSelected ? 3 : 1} />
      </mesh>
      
      {/* Front Panel Features */}
      <PortVisuals node={node} h={h} onSelect={onSelect} />
      
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

export const MountedUnit = React.memo(MountedUnitComponent)
