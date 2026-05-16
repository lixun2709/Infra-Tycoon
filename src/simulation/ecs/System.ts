import { World } from './World'

/**
 * ECS System
 * Base class for simulation logic systems.
 */
export abstract class System {
  protected world: World
  constructor(world: World) {
    this.world = world
  }

  /**
   * Update system state for a given tick.
   * @param dt Delta time in seconds.
   */
  abstract update(dt: number): void
}
