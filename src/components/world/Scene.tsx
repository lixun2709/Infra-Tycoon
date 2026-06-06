import { Canvas } from '@react-three/fiber'
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { EnvironmentRenderer } from './renderers/EnvironmentRenderer'
import { CameraController } from './renderers/CameraController'
import { FloorRenderer } from './renderers/FloorRenderer'
import { OperationalPersonnelSystem } from './renderers/OperationalPersonnelSystem'
import { OverlayRenderer, BlueprintPreview, DeployWave } from './renderers/OverlayRenderer'
import { CableSystem } from './CableSystem'
import { HeatMapOverlay } from './HeatMapOverlay'
import { OverheadPowerSystem } from './renderers/OverheadPowerSystem'
import { Rack } from './Rack'

import { InteractionSystem } from '../../systems/InteractionSystem'
import { useInput } from '../../contexts/InputContext'

import { RenderStatsTracker } from './renderers/RenderStatsTracker'

export function Scene() {
  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const racks = useInfraStore(useShallow(state => state.nodes.filter((n: any) => n.type === 'rack' && n.siteId === currentSiteId)))
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  const { dispatchIntent } = useInput()

  return (
    <Canvas 
      className="h-full w-full" 
      camera={{ position: [0, 6, 20], fov: 45 }} 
      onPointerMissed={() => dispatchIntent({ type: 'DESELECT_NODE' })}
    >
      <RenderStatsTracker />
      <InteractionSystem />
      <CameraController />
      <EnvironmentRenderer />
      
      <OperationalPersonnelSystem />
      {/* Elevate all room-specific assets and active racks by +1.6m */}
      <group position={[0, 1.6, 0]}>
        <FloorRenderer />
        <BlueprintPreview />
        <DeployWave />
        <CableSystem />
        <HeatMapOverlay />
        <OverheadPowerSystem />
        <OverlayRenderer />
        {racks.map((rack: any) => (
          <Rack
            key={rack.id}
            id={rack.id}
            name={rack.name || rack.id}
            currentPowerKW={rack.currentPowerKW || 0}
            maxPowerKW={rack.maxPowerKW || 5.0}
            status={rack.status || 'online'}
            position={rack.position!}
            isSelected={selectedNodeId === rack.id}
            containmentType={rack.containmentType}
            uHeight={rack.uHeight || 42}
          />
        ))}
      </group>
    </Canvas>
  )
}
