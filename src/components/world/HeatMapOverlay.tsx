
import { useInfraStore } from '../../store/useInfraStore'
import { useShallow } from 'zustand/react/shallow'
import { Html } from '@react-three/drei'

export function HeatMapOverlay() {
  const { nodes, isHeatMapVisible } = useInfraStore(useShallow(state => ({
    nodes: state.nodes,
    isHeatMapVisible: state.isHeatMapVisible
  })))

  if (!isHeatMapVisible) return null

  // Check if there is at least one Environmental Sensor in the site to "provide" the data
  const hasSensor = nodes.some((n: any) => n.catalogKey === 'ENV_SENSOR')
  if (!hasSensor) return null

  const racks = nodes.filter((n: any) => n.type === 'rack')

  return (
    <group>
      {racks.map((rack: any) => {
        const temp = rack.temperature || 20
        // Color scale: 20C (Green) to 40C (Red)
        const factor = Math.min(1, Math.max(0, (temp - 20) / 20))
        const color = `rgb(${Math.floor(factor * 255)}, ${Math.floor((1 - factor) * 255)}, 0)`

        return (
          <group key={`heat-${rack.id}`} position={rack.position}>
            {/* Thermal Glow */}
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[1.1, 3.1, 1.1]} />
              <meshBasicMaterial color={color} transparent opacity={0.3} />
            </mesh>

            {/* Temperature Label */}
            <Html position={[0, 3.5, 0]} center>
              <div className="bg-black/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/20 whitespace-nowrap">
                <p className="text-[10px] font-black font-mono" style={{ color }}>
                  {temp.toFixed(1)}°C
                </p>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
