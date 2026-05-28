import type { CameraVec3 } from './cameraModes'

export interface BoundingBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY?: number
}

// Default map boundaries for the simulation site
export const DEFAULT_CAMERA_BOUNDS: BoundingBox = {
  minX: -50,
  maxX: 50,
  minZ: -50,
  maxZ: 50,
  minY: 0.5
}

/**
 * Clamps the target and camera position to remain within the specified bounding box.
 * This prevents the camera from panning into the void.
 */
export function clampCameraPosition(
  target: CameraVec3,
  position: CameraVec3,
  bounds: BoundingBox = DEFAULT_CAMERA_BOUNDS
): void {
  // Calculate offsets so the camera relative position is preserved
  const offsetX = position.x - target.x
  const offsetZ = position.z - target.z
  
  // Clamp target
  target.x = Math.max(bounds.minX, Math.min(bounds.maxX, target.x))
  target.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, target.z))

  if (bounds.minY !== undefined) {
    target.y = Math.max(bounds.minY, target.y)
  }

  // Restore relative position
  position.x = target.x + offsetX
  position.z = target.z + offsetZ
  
  if (bounds.minY !== undefined) {
    position.y = Math.max(bounds.minY, position.y)
  }
}
