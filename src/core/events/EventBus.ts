import type { AppEvent, EventHandler } from './EventTypes'

type SubscriptionId = string

class EventBusService {
  private handlers: Map<string, Map<SubscriptionId, EventHandler<any>>> = new Map()
  private nextSubscriptionId = 1

  /**
   * Subscribe to a specific event type.
   * @param eventType The specific string type of the event (e.g., 'SIMULATION_TICK')
   * @param handler The callback to invoke
   * @returns A function to unsubscribe
   */
  public subscribe<T extends AppEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Map())
    }

    const subId = `sub_${this.nextSubscriptionId++}`
    this.handlers.get(eventType)!.set(subId, handler)

    return () => {
      this.unsubscribe(eventType, subId)
    }
  }

  /**
   * Subscribe to ALL events. Useful for generic loggers or telemetry aggregators.
   */
  public subscribeAll(handler: EventHandler<AppEvent>): () => void {
    return this.subscribe('*', handler)
  }

  /**
   * Publish an event to all subscribers.
   */
  public publish<T extends AppEvent>(event: T): void {
    // Notify specific subscribers
    if (this.handlers.has(event.type)) {
      const typeHandlers = this.handlers.get(event.type)!
      for (const handler of typeHandlers.values()) {
        try {
          handler(event)
        } catch (error) {
          console.error(`[EventBus] Error in handler for ${event.type}:`, error)
        }
      }
    }

    // Notify generic/global subscribers
    if (this.handlers.has('*')) {
      const globalHandlers = this.handlers.get('*')!
      for (const handler of globalHandlers.values()) {
        try {
          handler(event)
        } catch (error) {
          console.error(`[EventBus] Error in global handler:`, error)
        }
      }
    }
  }

  private unsubscribe(eventType: string, subId: SubscriptionId): void {
    if (this.handlers.has(eventType)) {
      this.handlers.get(eventType)!.delete(subId)
    }
  }
}

export const EventBus = new EventBusService()
