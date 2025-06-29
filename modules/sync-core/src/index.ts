/**
 * Sync Core Module - Main exports
 * 
 * Real-time synchronization module for VJ Application
 */

export { SyncClient } from './core/SyncClient'

// Export all types
export * from './types'

// Main module interface implementation
import { SyncClient } from './core/SyncClient'
import { 
  ISyncCoreModule, 
  SyncCoreConfig, 
  ISyncClient,
  Room,
  Participant,
  AllSyncEvents,
  EventHandler 
} from './types'

export class SyncCoreModule implements ISyncCoreModule {
  private client: SyncClient
  private initialized: boolean = false

  constructor() {
    this.client = new SyncClient()
  }

  async initialize(config: SyncCoreConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('SyncCoreModule already initialized')
    }

    try {
      await this.client.connect(config.client)
      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize SyncCoreModule: ${error}`)
    }
  }

  async destroy(): Promise<void> {
    if (this.initialized) {
      await this.client.disconnect()
      this.initialized = false
    }
  }

  getClient(): ISyncClient {
    if (!this.initialized) {
      throw new Error('SyncCoreModule not initialized')
    }
    return this.client
  }

  async createRoom(room: Omit<Room, 'id' | 'participants' | 'createdAt'>): Promise<Room> {
    return this.client.createRoom(room)
  }

  async joinRoom(roomId: string, participant: Omit<Participant, 'id' | 'joinedAt' | 'lastSeen'>): Promise<Room> {
    return this.client.joinRoom(roomId, participant)
  }

  addEventListener<T extends AllSyncEvents>(type: T['type'], handler: EventHandler<T>): void {
    this.client.addEventListener(type, handler)
  }

  removeEventListener<T extends AllSyncEvents>(type: T['type'], handler: EventHandler<T>): void {
    this.client.removeEventListener(type, handler)
  }

  emit<T extends AllSyncEvents>(event: T): void {
    this.client.emit(event)
  }
}

// Export singleton instance
export const syncCore = new SyncCoreModule()