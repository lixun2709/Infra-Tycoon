export interface EventRegistry {
  'tick': { dt: number; total: number };
  'entity:created': { id: string };
  'entity:destroyed': { id: string };
  'alert:pushed': { severity: string; message: string };
  [key: string]: unknown;
}

export type EventCallback<K extends keyof EventRegistry> = (payload: EventRegistry[K]) => void;

export class EventBus {
  private listeners: Map<keyof EventRegistry, Set<EventCallback<keyof EventRegistry>>> = new Map();

  subscribe<K extends keyof EventRegistry>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.unsubscribe(event, callback);
  }

  unsubscribe<K extends keyof EventRegistry>(event: K, callback: EventCallback<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  publish<K extends keyof EventRegistry>(event: K, payload: EventRegistry[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach(callback => callback(payload));
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const globalEventBus = new EventBus();
