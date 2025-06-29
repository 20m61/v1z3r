/**
 * Preset Storage Module Types
 * 
 * Types for VJ preset management, storage, and sharing
 */

import { z } from 'zod'

// Core preset types
export type EffectType = 
  | 'spectrum' 
  | 'waveform' 
  | 'particles' 
  | 'lyrics' 
  | 'camera'
  | 'custom'

export type ColorTheme = 
  | 'rainbow' 
  | 'blue' 
  | 'purple' 
  | 'green' 
  | 'red' 
  | 'custom'

export type BlendMode = 
  | 'normal'
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'soft-light' 
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn'

// Layer configuration schema
export const LayerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  effectType: z.enum(['spectrum', 'waveform', 'particles', 'lyrics', 'camera', 'custom']),
  opacity: z.number().min(0).max(1),
  isVisible: z.boolean(),
  blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn']),
  parameters: z.record(z.any()),
  order: z.number().int().min(0),
  audioReactive: z.boolean().optional(),
  voiceControlled: z.boolean().optional()
})

export type LayerConfig = z.infer<typeof LayerConfigSchema>

// Global settings schema
export const GlobalSettingsSchema = z.object({
  colorTheme: z.enum(['rainbow', 'blue', 'purple', 'green', 'red', 'custom']),
  sensitivity: z.number().min(0.1).max(5.0),
  speed: z.number().min(0.1).max(3.0),
  masterOpacity: z.number().min(0).max(1),
  audioSource: z.enum(['microphone', 'system', 'file']).optional(),
  voiceLanguage: z.string().optional(),
  midiChannel: z.number().int().min(1).max(16).optional()
})

export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>

// Preset schema with comprehensive validation
export const PresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  version: z.string().default('1.0.0'),
  layers: z.array(LayerConfigSchema),
  globalSettings: GlobalSettingsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorId: z.string(),
  authorName: z.string(),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  category: z.enum(['music', 'ambient', 'party', 'experimental', 'professional', 'educational']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  duration: z.number().positive().optional(), // in seconds
  bpm: z.number().positive().optional(),
  key: z.string().optional(), // musical key
  genre: z.string().optional(),
  downloadCount: z.number().int().min(0).default(0),
  likeCount: z.number().int().min(0).default(0),
  rating: z.number().min(0).max(5).optional(),
  thumbnailUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(), // Short video/image preview
  fileSize: z.number().positive().optional(), // in bytes
  checksum: z.string().optional() // For file integrity
})

export type Preset = z.infer<typeof PresetSchema>

// Preset collection/playlist
export const PresetCollectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  authorId: z.string(),
  authorName: z.string(),
  presetIds: z.array(z.string().uuid()),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  thumbnailUrl: z.string().url().optional()
})

export type PresetCollection = z.infer<typeof PresetCollectionSchema>

// Search and filtering
export interface PresetSearchFilters {
  query?: string
  tags?: string[]
  category?: string
  difficulty?: string
  authorId?: string
  isPublic?: boolean
  isFeatured?: boolean
  minRating?: number
  bpmRange?: [number, number]
  createdAfter?: Date
  createdBefore?: Date
}

export interface PresetSearchOptions {
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'downloadCount' | 'likeCount' | 'rating' | 'name'
  sortOrder?: 'asc' | 'desc'
  includeStats?: boolean
}

export interface PresetSearchResult {
  presets: Preset[]
  total: number
  hasMore: boolean
  filters: PresetSearchFilters
  options: PresetSearchOptions
}

// Preset operations
export interface PresetCreateInput {
  name: string
  description?: string
  layers: LayerConfig[]
  globalSettings: GlobalSettings
  tags?: string[]
  isPublic?: boolean
  category?: string
  difficulty?: string
  duration?: number
  bpm?: number
  key?: string
  genre?: string
  thumbnailFile?: Buffer
  previewFile?: Buffer
}

export interface PresetUpdateInput {
  name?: string
  description?: string
  layers?: LayerConfig[]
  globalSettings?: GlobalSettings
  tags?: string[]
  isPublic?: boolean
  category?: string
  difficulty?: string
  duration?: number
  bpm?: number
  key?: string
  genre?: string
  thumbnailFile?: Buffer
  previewFile?: Buffer
}

// User interactions
export interface PresetInteraction {
  userId: string
  presetId: string
  type: 'like' | 'download' | 'share' | 'report'
  timestamp: string
  metadata?: Record<string, any>
}

// Analytics
export interface PresetAnalytics {
  presetId: string
  views: number
  downloads: number
  likes: number
  shares: number
  averageRating: number
  ratingCount: number
  popularityScore: number
  trendingScore: number
  lastUpdated: string
}

// Export/Import formats
export interface PresetExportFormat {
  format: 'json' | 'qr' | 'url' | 'zip'
  includeAssets?: boolean
  compression?: boolean
  encryption?: boolean
}

export interface PresetImportResult {
  success: boolean
  preset?: Preset
  errors?: string[]
  warnings?: string[]
}

// Storage configuration
export interface PresetStorageConfig {
  dynamodb: {
    tableName: string
    region: string
    endpoint?: string
  }
  s3: {
    bucketName: string
    region: string
    endpoint?: string
  }
  cache?: {
    enabled: boolean
    ttl: number // in seconds
    maxSize: number // in MB
  }
  validation?: {
    strictMode: boolean
    maxFileSize: number // in MB
    allowedImageTypes: string[]
    allowedAudioTypes: string[]
  }
}

// Repository interfaces
export interface IPresetRepository {
  // Basic CRUD operations
  create(input: PresetCreateInput, authorId: string): Promise<Preset>
  findById(id: string): Promise<Preset | null>
  update(id: string, input: PresetUpdateInput): Promise<Preset>
  delete(id: string): Promise<void>
  
  // Search and listing
  search(filters: PresetSearchFilters, options?: PresetSearchOptions): Promise<PresetSearchResult>
  findByAuthor(authorId: string, options?: PresetSearchOptions): Promise<Preset[]>
  findPublic(options?: PresetSearchOptions): Promise<Preset[]>
  findFeatured(options?: PresetSearchOptions): Promise<Preset[]>
  findByTags(tags: string[], options?: PresetSearchOptions): Promise<Preset[]>
  
  // User interactions
  addInteraction(interaction: PresetInteraction): Promise<void>
  getAnalytics(presetId: string): Promise<PresetAnalytics>
  updateAnalytics(presetId: string, updates: Partial<PresetAnalytics>): Promise<void>
  
  // Asset management
  uploadThumbnail(presetId: string, file: Buffer, mimeType: string): Promise<string>
  uploadPreview(presetId: string, file: Buffer, mimeType: string): Promise<string>
  deleteAssets(presetId: string): Promise<void>
}

export interface IPresetService {
  // Service layer operations
  createPreset(input: PresetCreateInput, authorId: string, authorName: string): Promise<Preset>
  getPreset(id: string): Promise<Preset | null>
  updatePreset(id: string, input: PresetUpdateInput, userId: string): Promise<Preset>
  deletePreset(id: string, userId: string): Promise<void>
  
  // Search and discovery
  searchPresets(filters: PresetSearchFilters, options?: PresetSearchOptions): Promise<PresetSearchResult>
  getTrendingPresets(limit?: number): Promise<Preset[]>
  getRecommendedPresets(userId: string, limit?: number): Promise<Preset[]>
  
  // User operations
  likePreset(presetId: string, userId: string): Promise<void>
  unlikePreset(presetId: string, userId: string): Promise<void>
  downloadPreset(presetId: string, userId: string): Promise<Preset>
  sharePreset(presetId: string, userId: string, format: PresetExportFormat): Promise<string>
  
  // Collections
  createCollection(collection: Omit<PresetCollection, 'id' | 'createdAt' | 'updatedAt'>): Promise<PresetCollection>
  addToCollection(collectionId: string, presetId: string): Promise<void>
  removeFromCollection(collectionId: string, presetId: string): Promise<void>
  
  // Import/Export
  exportPreset(presetId: string, format: PresetExportFormat): Promise<Buffer | string>
  importPreset(data: Buffer | string, format: string, userId: string): Promise<PresetImportResult>
  generateQRCode(presetId: string): Promise<Buffer>
  parseQRCode(qrData: string): Promise<Preset>
}

// Module interface
export interface IPresetStorageModule {
  initialize(config: PresetStorageConfig): Promise<void>
  destroy(): Promise<void>
  getRepository(): IPresetRepository
  getService(): IPresetService
  
  // Health check
  healthCheck(): Promise<{ dynamodb: boolean; s3: boolean; overall: boolean }>
}

// Error classes
export class PresetError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'PresetError'
  }
}

export class PresetNotFoundError extends PresetError {
  constructor(id: string) {
    super(`Preset not found: ${id}`, 'PRESET_NOT_FOUND', { id })
    this.name = 'PresetNotFoundError'
  }
}

export class PresetValidationError extends PresetError {
  constructor(message: string, details?: any) {
    super(message, 'PRESET_VALIDATION_ERROR', details)
    this.name = 'PresetValidationError'
  }
}

export class PresetStorageError extends PresetError {
  constructor(message: string, details?: any) {
    super(message, 'PRESET_STORAGE_ERROR', details)
    this.name = 'PresetStorageError'
  }
}

export class PresetPermissionError extends PresetError {
  constructor(message: string, details?: any) {
    super(message, 'PRESET_PERMISSION_ERROR', details)
    this.name = 'PresetPermissionError'
  }
}

// Utility types
export type PresetEventType = 
  | 'preset_created'
  | 'preset_updated' 
  | 'preset_deleted'
  | 'preset_liked'
  | 'preset_downloaded'
  | 'preset_shared'

export interface PresetEvent {
  type: PresetEventType
  presetId: string
  userId: string
  timestamp: string
  metadata?: Record<string, any>
}