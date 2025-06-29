/**
 * Event Bus for inter-module communication
 * Provides a centralized event system for all VJ application modules
 */

import { VJEvent, EventHandler, Unsubscribe } from '../types'

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map()
  private onceListeners: Map<string, Set<EventHandler>> = new Map()
  private isDestroyed = false

  /**
   * Subscribe to events of a specific type
   */
  on<T extends VJEvent>(eventType: string, handler: EventHandler<T>): Unsubscribe {
    if (this.isDestroyed) {
      console.warn('EventBus: Attempting to add listener to destroyed bus')
      return () => {}
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }

    this.listeners.get(eventType)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(eventType)
      if (handlers) {
        handlers.delete(handler as EventHandler)
        if (handlers.size === 0) {
          this.listeners.delete(eventType)
        }
      }
    }
  }

  /**
   * Subscribe to events of a specific type (one-time only)
   */
  once<T extends VJEvent>(eventType: string, handler: EventHandler<T>): Unsubscribe {
    if (this.isDestroyed) {
      console.warn('EventBus: Attempting to add once listener to destroyed bus')
      return () => {}
    }

    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, new Set())
    }

    this.onceListeners.get(eventType)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => {
      const handlers = this.onceListeners.get(eventType)
      if (handlers) {
        handlers.delete(handler as EventHandler)
        if (handlers.size === 0) {
          this.onceListeners.delete(eventType)
        }
      }
    }
  }

  /**
   * Remove event listener
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.listeners.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(eventType)
      }
    }

    const onceHandlers = this.onceListeners.get(eventType)
    if (onceHandlers) {
      onceHandlers.delete(handler)
      if (onceHandlers.size === 0) {
        this.onceListeners.delete(eventType)
      }
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  emit(event: VJEvent): void {
    if (this.isDestroyed) {
      console.warn('EventBus: Attempting to emit event on destroyed bus')
      return
    }

    const { type } = event

    // Handle regular listeners
    const handlers = this.listeners.get(type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error(`EventBus: Error in event handler for ${type}:`, error)
        }
      })
    }

    // Handle once listeners
    const onceHandlers = this.onceListeners.get(type)
    if (onceHandlers) {
      const handlersArray = Array.from(onceHandlers)
      this.onceListeners.delete(type) // Remove all once listeners after execution

      handlersArray.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error(`EventBus: Error in once event handler for ${type}:`, error)
        }
      })
    }
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType)
      this.onceListeners.delete(eventType)
    } else {
      this.listeners.clear()
      this.onceListeners.clear()
    }
  }

  /**
   * Get the number of listeners for a specific event type
   */
  listenerCount(eventType: string): number {
    const regularCount = this.listeners.get(eventType)?.size || 0
    const onceCount = this.onceListeners.get(eventType)?.size || 0
    return regularCount + onceCount
  }

  /**
   * Get all event types that have listeners
   */
  eventNames(): string[] {
    const regularTypes = Array.from(this.listeners.keys())
    const onceTypes = Array.from(this.onceListeners.keys())
    return Array.from(new Set([...regularTypes, ...onceTypes]))
  }

  /**
   * Create a filtered event stream
   */
  filter<T extends VJEvent>(predicate: (event: VJEvent) => event is T): EventBus {
    const filteredBus = new EventBus()

    // Subscribe to all events and filter them
    const allTypes = this.eventNames()
    allTypes.forEach(type => {
      this.on(type, (event) => {
        if (predicate(event)) {
          filteredBus.emit(event)
        }
      })
    })

    return filteredBus
  }

  /**
   * Create an event stream for a specific module
   */
  forModule(moduleName: string): EventBus {
    return this.filter(event => event.source === moduleName)
  }

  /**
   * Destroy the event bus and clean up all listeners
   */
  destroy(): void {
    this.removeAllListeners()
    this.isDestroyed = true
  }

  /**
   * Check if the event bus is destroyed
   */
  get destroyed(): boolean {
    return this.isDestroyed
  }
}

// Global event bus instance for the application
export const globalEventBus = new EventBus()

// Convenience functions for common operations
export const on = globalEventBus.on.bind(globalEventBus)
export const once = globalEventBus.once.bind(globalEventBus)
export const off = globalEventBus.off.bind(globalEventBus)
export const emit = globalEventBus.emit.bind(globalEventBus)

// Module-specific event buses
export const createModuleEventBus = (moduleName: string) => {
  const bus = new EventBus()
  
  // Forward events to global bus with module source
  const originalEmit = bus.emit.bind(bus)
  bus.emit = (event: VJEvent) => {
    const eventWithSource = { ...event, source: moduleName as any }
    originalEmit(eventWithSource)
    globalEventBus.emit(eventWithSource)
  }
  
  return bus
}