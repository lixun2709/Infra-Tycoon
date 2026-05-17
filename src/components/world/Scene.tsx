import { Canvas } from '@react-three/fiber'
import { useInfraStore } from '../../store/useInfraStore'
import { EnvironmentRenderer } from './renderers/EnvironmentRenderer'
import { CameraController } from './renderers/CameraController'
import { FloorRenderer } from './renderers/FloorRenderer'
import { CloudRenderer } from './renderers/CloudRenderer'
import { OverlayRenderer, BlueprintPreview, DeployWave } from './renderers/OverlayRenderer'
import { CableSystem } from './CableSystem'
import { HeatMapOverlay } from './HeatMapOverlay'
import { Rack } from './Rack'
import { MountedUnit } from './MountedUnit'

export function Scene() {
  const { nodes, selectedNodeId, setSelectedNode, currentSiteId } = useInfraStore()
  const racks = nodes.filter(n => n.type === 'rack' && n.siteId === currentSiteId)

  return (
    <Canvas 
      className="h-full w-full" 
      camera={{ position: [5, 4, 5], fov: 45 }} 
      onPointerMissed={() => useInfraStore.getState().setSelectedNode(null)}
    >
      <CameraController />
      <EnvironmentRenderer />
      <FloorRenderer />
      <CloudRenderer />
      <BlueprintPreview />
      <DeployWave />
      <CableSystem />
      <HeatMapOverlay />
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
          onSelect={setSelectedNode}
        >
          {nodes.filter(n => n.parentRackId === rack.id).map(hw => (
            <MountedUnit
              key={hw.id}
              node={hw}
              isSelected={selectedNodeId === hw.id}
              onSelect={setSelectedNode}
            />
          ))}
        </Rack>
      ))}
    </Canvas>
  )
}
