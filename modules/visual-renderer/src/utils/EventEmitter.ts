/**
 * EventEmitter utility for type-safe event handling
 * Used by VisualRenderer for event management
 */

export type EventHandler<T = any> = (data: T) => void

export class EventEmitter<EventMap extends Record<string, any> = Record<string, any>> {
  private listeners: Map<string, Set<EventHandler>> = new Map()

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set())
    }
    this.listeners.get(event as string)!.add(handler)
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const handlers = this.listeners.get(event as string)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(event as string)
      }
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event as string)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error)
        }
      })
    }
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }

  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event as string)?.size || 0
  }
}