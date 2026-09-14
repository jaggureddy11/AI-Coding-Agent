import { JagguEvents, EventKey, EventHandler } from '../types/events.js';

type AnyEventHandler = (payload: unknown) => void | Promise<void>;

export class EventBus {
  private readonly listeners = new Map<EventKey, Set<AnyEventHandler>>();

  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    const genericHandler = handler as unknown as AnyEventHandler;
    handlers.add(genericHandler);

    return () => {
      handlers?.delete(genericHandler);
      if (handlers?.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<K extends EventKey>(event: K, payload: JagguEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          void handler(payload);
        } catch {
          // Prevent individual listener failures from breaking the event loop
        }
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
