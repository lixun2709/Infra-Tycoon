import { RACK_HEIGHT, U_WORLD } from '../../physics/dimensions'

export interface CameraVec3 {
  x: number
  y: number
  z: number
}

/**
 * RTS-style planar movement relative to camera's yaw angle.
 */
export function computeRTSPlanarMove(
  yaw: number,
  moveX: number,
  moveZ: number,
  speed: number,
  delta: number,
  outTarget: CameraVec3,
  outCamera: CameraVec3
): void {
  const actualSpeed = delta * speed
  const worldMoveX = moveX * Math.cos(yaw) + moveZ * Math.sin(yaw)
  const worldMoveZ = -moveX * Math.sin(yaw) + moveZ * Math.cos(yaw)

  outTarget.x += worldMoveX * actualSpeed
  outTarget.z += worldMoveZ * actualSpeed
  outCamera.x += worldMoveX * actualSpeed
  outCamera.z += worldMoveZ * actualSpeed
}

/**
 * Computes exact 3D coordinate target for chassis slot & rack inspection.
 */
export function computeSlotInspectionTarget(
  selectedNode: { position: CameraVec3; parentRackId?: string | null; slotIndex?: number | null; uHeight?: number },
  parentRack: { position: CameraVec3 } | undefined,
  outTarget: CameraVec3
): void {
  if (selectedNode.parentRackId && parentRack) {
    // Math logic matching U-space dimensional bounds
    const yOffset = -RACK_HEIGHT / 2 + U_WORLD * ((selectedNode.slotIndex ?? 1) - 1 + (selectedNode.uHeight ?? 1) / 2)
    outTarget.x = parentRack.position.x
    outTarget.y = parentRack.position.y + RACK_HEIGHT / 2 + yOffset + 1.6 // Account for platform height
    outTarget.z = parentRack.position.z
  } else {
    outTarget.x = selectedNode.position.x
    outTarget.y = selectedNode.position.y + RACK_HEIGHT / 2 + 1.6 // Account for platform height
    outTarget.z = selectedNode.position.z
  }
}

/**
 * High-performance vector linear interpolation (lerp).
 */
export function lerpCameraVec3(
  current: CameraVec3,
  target: CameraVec3,
  lerpFactor: number,
  delta: number,
  out: CameraVec3
): void {
  const t = Math.min(1.0, lerpFactor * delta)
  out.x = current.x + (target.x - current.x) * t
  out.y = current.y + (target.y - current.y) * t
  out.z = current.z + (target.z - current.z) * t
}
