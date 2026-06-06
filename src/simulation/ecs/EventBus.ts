/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Entity, Component } from './types'

export interface ECSEventRegistry {
  'entity:registered': { entityId: Entity }
  'entity:removed': { entityId: Entity }
  'component:added': { entityId: Entity; componentName: string; component: Component }
  'component:removed': { entityId: Entity; componentName: string }
  'system:error': { systemName: string; error: Error }
  'thermal:throttle': { entityId: Entity; temperature: number; isThrottled: boolean }
  'power:overload': { entityId: Entity; load: number; limit: number }
  [key: string]: any
}

export type ECSEventCallback<K extends keyof ECSEventRegistry> = (payload: ECSEventRegistry[K]) => void

export class ECSEventBus {
   
  private listeners: Map<keyof ECSEventRegistry, Set<ECSEventCallback<any>>> = new Map()

  public subscribe<K extends keyof ECSEventRegistry>(event: K, callback: ECSEventCallback<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => this.unsubscribe(event, callback)
  }

  public unsubscribe<K extends keyof ECSEventRegistry>(event: K, callback: ECSEventCallback<K>): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback)
    }
  }

  public publish<K extends keyof ECSEventRegistry>(event: K, payload: ECSEventRegistry[K]): void {
    const set = this.listeners.get(event)
    if (set) {
      set.forEach(callback => {
        try {
          callback(payload)
        } catch (err) {
          console.error(`[[ECS EventBus]] Error executing listener for event ${String(event)}:`, err)
        }
      })
    }
  }

  public clear(): void {
    this.listeners.clear()
  }
}

