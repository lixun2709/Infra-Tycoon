import { Canvas } from '@react-three/fiber'
import { useInfraStore } from '../../store/useInfraStore'
import { EnvironmentRenderer } from './renderers/EnvironmentRenderer'
import { CameraController } from './renderers/CameraController'
import { FloorRenderer } from './renderers/FloorRenderer'
import { OperationalPersonnelSystem } from './renderers/OperationalPersonnelSystem'
import { OverlayRenderer, BlueprintPreview, DeployWave } from './renderers/OverlayRenderer'
import { CableSystem } from './CableSystem'
import { HeatMapOverlay } from './HeatMapOverlay'
import { OverheadPowerSystem } from './renderers/OverheadPowerSystem'
import { Rack } from './Rack'
import { MountedUnit } from './MountedUnit'

import { InteractionSystem } from '../../systems/InteractionSystem'
import { useInput } from '../../contexts/InputContext'

import { RenderStatsTracker } from './renderers/RenderStatsTracker'

export function Scene() {
  const { nodes, selectedNodeId, currentSiteId } = useInfraStore()
  const { dispatchIntent } = useInput()
  const racks = nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId)

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

        {racks.map((rack) => (
          <Rack
            key={rack.id}
            id={rack.id}
            name={rack.name}
            currentPowerKW={rack.currentPowerKW || 0}
            maxPowerKW={rack.maxPowerKW || 5.0}
            status={rack.status || 'online'}
            position={rack.position}
            isSelected={selectedNodeId === rack.id}
            containmentType={rack.containmentType}
          >
            {nodes.filter(n => n.parentRackId === rack.id).map(hw => (
              <MountedUnit
                key={hw.id}
                node={hw}
                isSelected={selectedNodeId === hw.id}
              />
            ))}
          </Rack>
        ))}
      </group>
    </Canvas>
  )
}
