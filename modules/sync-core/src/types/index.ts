/**
 * Sync Core Module Types
 * 
 * Types for real-time synchronization and communication between VJ modules
 */

import { z } from 'zod'

// Connection types
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface ConnectionConfig {
  url: string
  reconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
  timeout: number
  authentication?: {
    token?: string
    apiKey?: string
  }
}

export interface ConnectionInfo {
  id: string
  state: ConnectionState
  connectedAt?: Date
  lastPing?: Date
  latency?: number
  reconnectCount: number
  error?: Error
}

// Message types
export type MessageType = 
  | 'ping'
  | 'pong'
  | 'join_room'
  | 'leave_room'
  | 'broadcast'
  | 'direct_message'
  | 'parameter_update'
  | 'layer_update'
  | 'preset_update'
  | 'voice_command'
  | 'sync_state'
  | 'error'
  | 'authentication'

export const MessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'ping', 'pong', 'join_room', 'leave_room', 'broadcast', 
    'direct_message', 'parameter_update', 'layer_update', 
    'preset_update', 'voice_command', 'sync_state', 'error', 'authentication'
  ]),
  timestamp: z.number(),
  source: z.string(),
  target: z.string().optional(),
  roomId: z.string().optional(),
  data: z.any(),
  metadata: z.record(z.any()).optional(),
})

export type Message = z.infer<typeof MessageSchema>

// Room management
export interface Room {
  id: string
  name: string
  description?: string
  maxParticipants: number
  participants: Participant[]
  createdAt: Date
  isPrivate: boolean
  ownerId: string
  settings: RoomSettings
}

export interface Participant {
  id: string
  name: string
  role: 'host' | 'participant' | 'viewer'
  joinedAt: Date
  lastSeen: Date
  capabilities: ParticipantCapabilities
  metadata: Record<string, any>
}

export interface ParticipantCapabilities {
  canControlVisuals: boolean
  canControlAudio: boolean
  canManageLayers: boolean
  canSharePresets: boolean
  canInviteOthers: boolean
}

export interface RoomSettings {
  allowGuestControl: boolean
  syncParameters: boolean
  syncLayers: boolean
  syncPresets: boolean
  broadcastVoiceCommands: boolean
  requireApproval: boolean
}

// Synchronization types
export interface SyncState {
  version: number
  timestamp: number
  parameters: Record<string, any>
  layers: Array<{
    id: string
    parameters: Record<string, any>
    lastModified: number
  }>
  activePresetId?: string
  lastVoiceCommand?: {
    command: string
    timestamp: number
    confidence: number
  }
}

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  target: 'parameter' | 'layer' | 'preset'
  path: string
  value: any
  timestamp: number
  authorId: string
  version: number
}

export interface ConflictResolution {
  strategy: 'last_write_wins' | 'merge' | 'user_decision' | 'host_wins'
  conflictId: string
  operations: SyncOperation[]
  resolvedValue: any
  resolvedBy: string
  resolvedAt: number
}

// Event types
export interface SyncEvent {
  type: string
  timestamp: number
  source: string
  data: any
}

export interface ConnectionEvent extends SyncEvent {
  type: 'connection_opened' | 'connection_closed' | 'connection_error' | 'reconnect_attempt'
  data: {
    connectionId: string
    state: ConnectionState
    error?: Error
    attempt?: number
  }
}

export interface MessageEvent extends SyncEvent {
  type: 'message_sent' | 'message_received' | 'message_error'
  data: {
    message: Message
    error?: Error
  }
}

export interface RoomEvent extends SyncEvent {
  type: 'room_joined' | 'room_left' | 'participant_joined' | 'participant_left' | 'room_updated'
  data: {
    roomId: string
    participant?: Participant
    room?: Room
  }
}

export interface SyncStateEvent extends SyncEvent {
  type: 'state_updated' | 'conflict_detected' | 'conflict_resolved'
  data: {
    state?: SyncState
    operation?: SyncOperation
    conflict?: ConflictResolution
  }
}

export type AllSyncEvents = ConnectionEvent | MessageEvent | RoomEvent | SyncStateEvent

// Client interface
export interface ISyncClient {
  // Connection management
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  getConnectionInfo(): ConnectionInfo
  
  // Room management
  joinRoom(roomId: string, participant: Omit<Participant, 'id' | 'joinedAt' | 'lastSeen'>): Promise<Room>
  leaveRoom(roomId: string): Promise<void>
  createRoom(room: Omit<Room, 'id' | 'participants' | 'createdAt'>): Promise<Room>
  getRoomInfo(roomId: string): Promise<Room>
  updateRoomSettings(roomId: string, settings: Partial<RoomSettings>): Promise<void>
  
  // Message handling
  sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<void>
  broadcastToRoom(roomId: string, data: any, type?: MessageType): Promise<void>
  sendDirectMessage(targetId: string, data: any, type?: MessageType): Promise<void>
  
  // State synchronization
  syncState(state: Partial<SyncState>): Promise<void>
  getSyncState(): Promise<SyncState>
  applyOperation(operation: SyncOperation): Promise<void>
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>
  
  // Event handling
  addEventListener<T extends AllSyncEvents>(type: T['type'], handler: (event: T) => void): void
  removeEventListener<T extends AllSyncEvents>(type: T['type'], handler: (event: T) => void): void
  emit<T extends AllSyncEvents>(event: T): void
}

// Server interface (for testing and reference)
export interface ISyncServer {
  start(port: number): Promise<void>
  stop(): Promise<void>
  handleConnection(connection: WebSocket): void
  broadcastToRoom(roomId: string, message: Message): void
  getRoom(roomId: string): Room | undefined
  createRoom(room: Omit<Room, 'id' | 'participants' | 'createdAt'>): Room
  removeRoom(roomId: string): void
}

// Configuration types
export interface SyncCoreConfig {
  client: ConnectionConfig
  room?: {
    defaultMaxParticipants: number
    defaultSettings: RoomSettings
  }
  sync?: {
    conflictResolution: ConflictResolution['strategy']
    batchUpdates: boolean
    batchDelay: number
  }
  debug?: boolean
}

// Error types
export class SyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'SyncError'
  }
}

export class ConnectionError extends SyncError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details)
    this.name = 'ConnectionError'
  }
}

export class MessageError extends SyncError {
  constructor(message: string, details?: any) {
    super(message, 'MESSAGE_ERROR', details)
    this.name = 'MessageError'
  }
}

export class SyncStateError extends SyncError {
  constructor(message: string, details?: any) {
    super(message, 'SYNC_STATE_ERROR', details)
    this.name = 'SyncStateError'
  }
}

// Utility types
export type EventHandler<T = any> = (event: T) => void
export type MessageHandler = (message: Message) => void | Promise<void>
export type StateUpdateHandler = (state: SyncState) => void

// Re-export commonly used types from shared
export interface ISyncCoreModule {
  initialize(config: SyncCoreConfig): Promise<void>
  destroy(): Promise<void>
  getClient(): ISyncClient
  createRoom(room: Omit<Room, 'id' | 'participants' | 'createdAt'>): Promise<Room>
  joinRoom(roomId: string, participant: Omit<Participant, 'id' | 'joinedAt' | 'lastSeen'>): Promise<Room>
  addEventListener<T extends AllSyncEvents>(type: T['type'], handler: EventHandler<T>): void
  removeEventListener<T extends AllSyncEvents>(type: T['type'], handler: EventHandler<T>): void
  emit<T extends AllSyncEvents>(event: T): void
}