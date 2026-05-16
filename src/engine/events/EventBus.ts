export type EventCallback<T = any> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  subscribe<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.unsubscribe(event, callback);
  }

  unsubscribe<T>(event: string, callback: EventCallback<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  publish<T>(event: string, payload: T): void {
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
