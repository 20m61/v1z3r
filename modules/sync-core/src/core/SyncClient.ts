/**
 * SyncClient - WebSocket-based real-time synchronization client
 * 
 * Provides real-time communication for VJ Application modules.
 * Handles connection management, message passing, room management, and state synchronization.
 * 
 * Enhanced with reliability features for production use.
 */

import { v4 as uuidv4 } from 'uuid'
import { 
  ISyncClient,
  ConnectionConfig,
  ConnectionInfo,
  ConnectionState,
  Message,
  MessageSchema,
  Room,
  Participant,
  SyncState,
  SyncOperation,
  ConflictResolution,
  AllSyncEvents,
  ConnectionError,
  MessageError,
  SyncStateError,
  EventHandler,
  MessageType
} from '../types'

// Enhanced WebSocket configuration for reliability
interface ReliabilityConfig {
  maxReconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
  messageTimeout: number
}

export class SyncClient implements ISyncClient {
  private ws: WebSocket | null = null
  private connectionInfo: ConnectionInfo
  private config: ConnectionConfig | null = null
  private eventListeners: Map<string, Set<EventHandler>> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map()
  private pingStartTime: number = 0
  private reliabilityConfig: ReliabilityConfig

  constructor() {
    this.connectionInfo = {
      id: uuidv4(),
      state: 'disconnected',
      reconnectCount: 0
    }
    
    // Initialize reliability configuration
    this.reliabilityConfig = {
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      messageTimeout: 5000
    }
  }

  // Connection Management with Enhanced Reliability
  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    this.connectionInfo.state = 'connecting'
    this.connectionInfo.error = undefined

    // Update reliability config with user settings
    this.reliabilityConfig = {
      maxReconnectAttempts: config.reconnectAttempts || this.reliabilityConfig.maxReconnectAttempts,
      reconnectDelay: config.reconnectDelay || this.reliabilityConfig.reconnectDelay,
      heartbeatInterval: config.heartbeatInterval || this.reliabilityConfig.heartbeatInterval,
      messageTimeout: config.timeout || this.reliabilityConfig.messageTimeout
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.url)
        
        const timeout = setTimeout(() => {
          this.cleanup()
          const error = new ConnectionError('Connection timeout')
          this.connectionInfo.error = error
          this.connectionInfo.state = 'error'
          reject(error)
        }, config.timeout)

        this.ws.addEventListener('open', () => {
          clearTimeout(timeout)
          this.connectionInfo.state = 'connected'
          this.connectionInfo.connectedAt = new Date()
          this.connectionInfo.reconnectCount = 0
          
          this.startHeartbeat()
          this.emit({
            type: 'connection_opened',
            timestamp: Date.now(),
            source: 'client',
            data: {
              connectionId: this.connectionInfo.id,
              state: this.connectionInfo.state
            }
          })
          
          resolve()
        })

        this.ws.addEventListener('error', (error) => {
          clearTimeout(timeout)
          const connectionError = new ConnectionError('WebSocket connection error', error)
          this.connectionInfo.error = connectionError
          this.connectionInfo.state = 'error'
          
          this.emit({
            type: 'connection_error',
            timestamp: Date.now(),
            source: 'client',
            data: {
              connectionId: this.connectionInfo.id,
              state: this.connectionInfo.state,
              error: connectionError
            }
          })
          
          reject(connectionError)
        })

        this.ws.addEventListener('close', (event) => {
          this.stopHeartbeat()
          
          if (!event.wasClean && this.connectionInfo.state === 'connected') {
            this.handleReconnection()
          } else {
            this.connectionInfo.state = 'disconnected'
            this.emit({
              type: 'connection_closed',
              timestamp: Date.now(),
              source: 'client',
              data: {
                connectionId: this.connectionInfo.id,
                state: this.connectionInfo.state
              }
            })
          }
        })

        this.ws.addEventListener('message', (event) => {
          this.handleIncomingMessage(event.data)
        })

      } catch (error) {
        const connectionError = new ConnectionError('Failed to create WebSocket connection', error)
        this.connectionInfo.error = connectionError
        this.connectionInfo.state = 'error'
        reject(connectionError)
      }
    })
  }

  async disconnect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === 1)) {
      this.stopHeartbeat()
      this.clearReconnectTimeout()
      this.ws.close(1000, 'Client disconnect')
    }
    
    this.connectionInfo.state = 'disconnected'
    this.cleanup()
  }

  async reconnect(): Promise<void> {
    if (this.config) {
      await this.disconnect()
      await this.connect(this.config)
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return { ...this.connectionInfo }
  }

  // Room Management
  async joinRoom(roomId: string, participant: Omit<Participant, 'id' | 'joinedAt' | 'lastSeen'>): Promise<Room> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type: 'join_room',
      source: this.connectionInfo.id,
      roomId,
      data: { participant }
    }

    return new Promise((resolve, reject) => {
      const requestId = this.sendMessageAndWaitForResponse(message, (response: Message) => {
        if (response.data.success && response.data.room) {
          resolve(response.data.room)
        } else {
          reject(new Error(response.data.error || 'Failed to join room'))
        }
      })
    })
  }

  async leaveRoom(roomId: string): Promise<void> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type: 'leave_room',
      source: this.connectionInfo.id,
      roomId,
      data: {}
    }

    await this.sendMessage(message)
  }

  async createRoom(room: Omit<Room, 'id' | 'participants' | 'createdAt'>): Promise<Room> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type: 'join_room', // Server uses join_room for both create and join
      source: this.connectionInfo.id,
      data: { createRoom: room }
    }

    return new Promise((resolve, reject) => {
      this.sendMessageAndWaitForResponse(message, (response: Message) => {
        if (response.data.success && response.data.room) {
          resolve(response.data.room)
        } else {
          reject(new Error(response.data.error || 'Failed to create room'))
        }
      })
    })
  }

  async getRoomInfo(roomId: string): Promise<Room> {
    // Implementation would request room info from server
    throw new Error('getRoomInfo not implemented')
  }

  async updateRoomSettings(roomId: string, settings: Partial<Room['settings']>): Promise<void> {
    // Implementation would send room settings update
    throw new Error('updateRoomSettings not implemented')
  }

  // Message Handling
  async sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    if (!this.ws || (this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== 1)) {
      throw new MessageError('WebSocket is not connected')
    }

    const fullMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now()
    }

    // Validate message format
    try {
      MessageSchema.parse(fullMessage)
    } catch (error) {
      throw new MessageError('Invalid message format', error)
    }

    try {
      this.ws.send(JSON.stringify(fullMessage))
      
      this.emit({
        type: 'message_sent',
        timestamp: Date.now(),
        source: 'client',
        data: { message: fullMessage }
      })
    } catch (error) {
      throw new MessageError('Failed to send message', error)
    }
  }

  async broadcastToRoom(roomId: string, data: any, type: MessageType = 'broadcast'): Promise<void> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type,
      source: this.connectionInfo.id,
      roomId,
      data
    }

    await this.sendMessage(message)
  }

  async sendDirectMessage(targetId: string, data: any, type: MessageType = 'direct_message'): Promise<void> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type,
      source: this.connectionInfo.id,
      target: targetId,
      data
    }

    await this.sendMessage(message)
  }

  // State Synchronization
  async syncState(state: Partial<SyncState>): Promise<void> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type: 'sync_state',
      source: this.connectionInfo.id,
      data: { state }
    }

    await this.sendMessage(message)
  }

  async getSyncState(): Promise<SyncState> {
    const message: Omit<Message, 'id' | 'timestamp'> = {
      type: 'sync_state',
      source: this.connectionInfo.id,
      data: { request: 'get_state' }
    }

    return new Promise((resolve, reject) => {
      this.sendMessageAndWaitForResponse(message, (response: Message) => {
        if (response.data.state) {
          resolve(response.data.state)
        } else {
          reject(new SyncStateError('Failed to get sync state'))
        }
      })
    })
  }

  async applyOperation(operation: SyncOperation): Promise<void> {
    // Implementation would apply sync operation
    throw new Error('applyOperation not implemented')
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    // Implementation would resolve sync conflict
    throw new Error('resolveConflict not implemented')
  }

  // Event Handling
  addEventListener<T extends AllSyncEvents>(type: T['type'], handler: EventHandler<T>): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set())
    }
    this.eventListeners.get(type)!.add(handler as EventHandler)
  }

  removeEventListener<T extends AllSyncEvents>(type: T['type'], handler: EventHandler<T>): void {
    const listeners = this.eventListeners.get(type)
    if (listeners) {
      listeners.delete(handler as EventHandler)
    }
  }

  emit<T extends AllSyncEvents>(event: T): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error('Event handler error:', error)
        }
      })
    }
  }

  // Private Methods
  private handleIncomingMessage(data: string): void {
    try {
      const message: Message = JSON.parse(data)
      
      // Validate message
      MessageSchema.parse(message)
      
      // Handle specific message types
      if (message.type === 'pong') {
        this.handlePongMessage(message)
      }
      
      // Check for pending request responses
      this.resolvePendingRequest(message)
      
      this.emit({
        type: 'message_received',
        timestamp: Date.now(),
        source: 'client',
        data: { message }
      })
      
    } catch (error) {
      this.emit({
        type: 'message_error',
        timestamp: Date.now(),
        source: 'client',
        data: { 
          message: { id: '', type: 'error', timestamp: Date.now(), source: 'client', data: {} },
          error: new MessageError('Failed to parse incoming message', error) 
        }
      })
    }
  }

  private sendMessageAndWaitForResponse(
    message: Omit<Message, 'id' | 'timestamp'>, 
    responseHandler: (message: Message) => void,
    timeoutMs: number = 5000
  ): string {
    const requestId = uuidv4()
    
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(requestId)
      responseHandler({ 
        id: requestId, 
        type: 'error', 
        timestamp: Date.now(), 
        source: 'timeout', 
        data: { error: 'Request timeout' } 
      })
    }, timeoutMs)

    this.pendingRequests.set(requestId, {
      resolve: responseHandler,
      reject: responseHandler,
      timeout
    })

    // Send message with request ID
    const messageWithId = { ...message, metadata: { requestId } }
    this.sendMessage(messageWithId).catch(error => {
      clearTimeout(timeout)
      this.pendingRequests.delete(requestId)
      responseHandler({ 
        id: requestId, 
        type: 'error', 
        timestamp: Date.now(), 
        source: 'error', 
        data: { error: error.message } 
      })
    })

    return requestId
  }

  private resolvePendingRequest(message: Message): void {
    const requestId = message.metadata?.requestId
    if (requestId && this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId)!
      clearTimeout(request.timeout)
      this.pendingRequests.delete(requestId)
      request.resolve(message)
    }
  }

  private startHeartbeat(): void {
    if (this.reliabilityConfig.heartbeatInterval > 0) {
      this.heartbeatInterval = setInterval(() => {
        this.sendPing()
      }, this.reliabilityConfig.heartbeatInterval)
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private sendPing(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === 1)) {
      this.pingStartTime = Date.now()
      const pingMessage: Omit<Message, 'id' | 'timestamp'> = {
        type: 'ping',
        source: this.connectionInfo.id,
        data: {}
      }
      this.sendMessage(pingMessage).catch(() => {
        // Ignore ping errors - connection will handle reconnection
      })
    }
  }

  private handlePongMessage(message: Message): void {
    if (this.pingStartTime > 0) {
      const latency = Date.now() - this.pingStartTime
      this.connectionInfo.latency = latency
      this.connectionInfo.lastPing = new Date()
      this.pingStartTime = 0
    }
  }

  private handleReconnection(): void {
    if (!this.config || this.connectionInfo.reconnectCount >= this.reliabilityConfig.maxReconnectAttempts) {
      this.connectionInfo.state = 'error'
      this.connectionInfo.error = new ConnectionError('Max reconnection attempts reached')
      return
    }

    this.connectionInfo.state = 'reconnecting'
    this.connectionInfo.reconnectCount++

    this.emit({
      type: 'reconnect_attempt',
      timestamp: Date.now(),
      source: 'client',
      data: {
        connectionId: this.connectionInfo.id,
        state: this.connectionInfo.state,
        attempt: this.connectionInfo.reconnectCount
      }
    })

    // Enhanced exponential backoff with jitter
    const baseDelay = this.reliabilityConfig.reconnectDelay
    const exponentialDelay = baseDelay * Math.pow(2, this.connectionInfo.reconnectCount - 1)
    const maxDelay = 30000 // 30 seconds max
    const jitter = Math.random() * 0.3 * exponentialDelay
    const actualDelay = Math.min(exponentialDelay + jitter, maxDelay)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnect().catch(error => {
        this.connectionInfo.error = error
        this.handleReconnection() // Try again
      })
    }, actualDelay)
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  private cleanup(): void {
    this.stopHeartbeat()
    this.clearReconnectTimeout()
    
    // Clear pending requests
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout)
    })
    this.pendingRequests.clear()
    
    this.ws = null
  }
}