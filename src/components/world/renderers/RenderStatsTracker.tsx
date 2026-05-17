import { useFrame } from '@react-three/fiber'
import { performanceMonitor } from '../../../simulation/PerformanceMonitor'

/**
 * RenderStatsTracker
 * Subcomponent mounted within the R3F Canvas to read real-time WebGLRenderer statistics
 * and push them directly to the PerformanceMonitor singleton.
 */
export function RenderStatsTracker() {
  useFrame(({ gl }) => {
    // gl represents the active WebGLRenderer instance in React Three Fiber
    performanceMonitor.updateRenderMetrics(
      gl.info.render.calls,
      gl.info.render.triangles,
      gl.info.memory.geometries,
      gl.info.memory.textures
    )
  })

  return null
}
