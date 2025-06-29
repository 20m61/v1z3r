/**
 * PresetRepository - DynamoDB-based preset storage implementation
 * 
 * Handles CRUD operations for VJ presets with DynamoDB and S3 integration.
 * Provides search, analytics, and asset management functionality.
 * 
 * Following TDD principles: implementing minimal functionality to pass tests.
 */

import { 
  DynamoDBClient,
  DynamoDBClientConfig 
} from '@aws-sdk/client-dynamodb'
import { 
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb'
import { 
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { 
  IPresetRepository,
  Preset,
  PresetCreateInput,
  PresetUpdateInput,
  PresetSearchFilters,
  PresetSearchOptions,
  PresetSearchResult,
  PresetInteraction,
  PresetAnalytics,
  PresetStorageConfig,
  PresetSchema,
  PresetNotFoundError,
  PresetValidationError,
  PresetStorageError
} from '../types'

export class PresetRepository implements IPresetRepository {
  private dynamoClient: DynamoDBDocumentClient
  private s3Client: S3Client
  private config: PresetStorageConfig

  constructor(config: PresetStorageConfig) {
    this.validateConfig(config)
    this.config = config

    // Initialize DynamoDB client
    const dynamoConfig: DynamoDBClientConfig = {
      region: config.dynamodb.region
    }
    if (config.dynamodb.endpoint) {
      dynamoConfig.endpoint = config.dynamodb.endpoint
    }
    
    const dynamoBase = new DynamoDBClient(dynamoConfig)
    this.dynamoClient = DynamoDBDocumentClient.from(dynamoBase)

    // Initialize S3 client
    const s3Config: S3ClientConfig = {
      region: config.s3.region
    }
    if (config.s3.endpoint) {
      s3Config.endpoint = config.s3.endpoint
    }
    
    this.s3Client = new S3Client(s3Config)
  }

  // Basic CRUD operations
  async create(input: PresetCreateInput, authorId: string): Promise<Preset> {
    // Validate input
    this.validateCreateInput(input)

    // Create preset object
    const preset: Preset = {
      id: uuidv4(),
      name: input.name,
      description: input.description,
      version: '1.0.0',
      layers: input.layers,
      globalSettings: input.globalSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorId,
      authorName: '', // Will be set by service layer
      tags: input.tags || [],
      isPublic: input.isPublic || false,
      isFeatured: false,
      category: input.category as Preset['category'],
      difficulty: input.difficulty as Preset['difficulty'],
      duration: input.duration,
      bpm: input.bpm,
      key: input.key,
      genre: input.genre,
      downloadCount: 0,
      likeCount: 0
    }

    // Validate against schema
    try {
      PresetSchema.parse(preset)
    } catch (error) {
      throw new PresetValidationError('Invalid preset data', error)
    }

    try {
      // Store in DynamoDB
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.dynamodb.tableName,
        Item: preset
      }))

      return preset
    } catch (error) {
      throw new PresetStorageError('Failed to create preset', error)
    }
  }

  async findById(id: string): Promise<Preset | null> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.dynamodb.tableName,
        Key: { id }
      }))

      if (!result.Item) {
        return null
      }

      return result.Item as Preset
    } catch (error) {
      throw new PresetStorageError('Failed to find preset', error)
    }
  }

  async update(id: string, input: PresetUpdateInput): Promise<Preset> {
    // Validate input
    this.validateUpdateInput(input)

    // First check if preset exists
    const existing = await this.findById(id)
    if (!existing) {
      throw new PresetNotFoundError(id)
    }

    // Build update expression
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    // Helper to add update expression
    const addUpdate = (field: string, value: any) => {
      if (value !== undefined) {
        const attr = `#${field}`
        const val = `:${field}`
        updateExpressions.push(`${attr} = ${val}`)
        expressionAttributeNames[attr] = field
        expressionAttributeValues[val] = value
      }
    }

    // Add fields to update
    addUpdate('name', input.name)
    addUpdate('description', input.description)
    addUpdate('layers', input.layers)
    addUpdate('globalSettings', input.globalSettings)
    addUpdate('tags', input.tags)
    addUpdate('isPublic', input.isPublic)
    addUpdate('category', input.category)
    addUpdate('difficulty', input.difficulty)
    addUpdate('duration', input.duration)
    addUpdate('bpm', input.bpm)
    addUpdate('key', input.key)
    addUpdate('genre', input.genre)
    addUpdate('updatedAt', new Date().toISOString())

    if (updateExpressions.length === 0) {
      return existing
    }

    try {
      const result = await this.dynamoClient.send(new UpdateCommand({
        TableName: this.config.dynamodb.tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }))

      return result.Attributes as Preset
    } catch (error) {
      throw new PresetStorageError('Failed to update preset', error)
    }
  }

  async delete(id: string): Promise<void> {
    // First check if preset exists and get its data for cleanup
    const existing = await this.findById(id)
    if (!existing) {
      throw new PresetNotFoundError(id)
    }

    try {
      // Delete from DynamoDB
      await this.dynamoClient.send(new DeleteCommand({
        TableName: this.config.dynamodb.tableName,
        Key: { id }
      }))

      // Delete associated assets
      await this.deleteAssets(id)
    } catch (error) {
      throw new PresetStorageError('Failed to delete preset', error)
    }
  }

  // Search and listing
  async search(filters: PresetSearchFilters, options: PresetSearchOptions = {}): Promise<PresetSearchResult> {
    const {
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options

    try {
      // Build scan parameters for search
      const scanParams: any = {
        TableName: this.config.dynamodb.tableName,
        Limit: limit
      }

      // Add filter expression if needed
      const filterExpressions: string[] = []
      const expressionAttributeNames: Record<string, string> = {}
      const expressionAttributeValues: Record<string, any> = {}

      if (filters.query) {
        filterExpressions.push('contains(#name, :query)')
        expressionAttributeNames['#name'] = 'name'
        expressionAttributeValues[':query'] = filters.query
      }

      if (filters.category) {
        filterExpressions.push('#category = :category')
        expressionAttributeNames['#category'] = 'category'
        expressionAttributeValues[':category'] = filters.category
      }

      if (filters.authorId) {
        filterExpressions.push('#authorId = :authorId')
        expressionAttributeNames['#authorId'] = 'authorId'
        expressionAttributeValues[':authorId'] = filters.authorId
      }

      if (filters.isPublic !== undefined) {
        filterExpressions.push('#isPublic = :isPublic')
        expressionAttributeNames['#isPublic'] = 'isPublic'
        expressionAttributeValues[':isPublic'] = filters.isPublic
      }

      if (filters.isFeatured !== undefined) {
        filterExpressions.push('#isFeatured = :isFeatured')
        expressionAttributeNames['#isFeatured'] = 'isFeatured'
        expressionAttributeValues[':isFeatured'] = filters.isFeatured
      }

      if (filters.tags && filters.tags.length > 0) {
        const tagExpressions = filters.tags.map((tag, index) => {
          const key = `:tag${index}`
          expressionAttributeValues[key] = tag
          return `contains(tags, ${key})`
        })
        filterExpressions.push(`(${tagExpressions.join(' OR ')})`)
      }

      if (filterExpressions.length > 0) {
        scanParams.FilterExpression = filterExpressions.join(' AND ')
        scanParams.ExpressionAttributeNames = expressionAttributeNames
        scanParams.ExpressionAttributeValues = expressionAttributeValues
      }

      // Execute scan
      const result = await this.dynamoClient.send(new ScanCommand(scanParams))
      
      let presets = (result.Items || []) as Preset[]

      // Apply client-side sorting (in production, consider using GSI for better performance)
      presets.sort((a, b) => {
        const aVal = this.getSortValue(a, sortBy)
        const bVal = this.getSortValue(b, sortBy)
        
        if (sortOrder === 'desc') {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0
        } else {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        }
      })

      // Apply pagination
      const total = result.Count || 0
      const hasMore = result.LastEvaluatedKey !== undefined

      return {
        presets,
        total,
        hasMore,
        filters,
        options
      }
    } catch (error) {
      throw new PresetStorageError('Failed to search presets', error)
    }
  }

  async findByAuthor(authorId: string, options: PresetSearchOptions = {}): Promise<Preset[]> {
    const { limit = 20 } = options

    try {
      // Use query with GSI on authorId (assuming it exists)
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.dynamodb.tableName,
        IndexName: 'AuthorIndex', // GSI on authorId
        KeyConditionExpression: '#authorId = :authorId',
        ExpressionAttributeNames: { '#authorId': 'authorId' },
        ExpressionAttributeValues: { ':authorId': authorId },
        Limit: limit,
        ScanIndexForward: false // Newest first
      }))

      return (result.Items || []) as Preset[]
    } catch (error) {
      // Fallback to scan if GSI doesn't exist
      return this.searchByAttribute('authorId', authorId, limit)
    }
  }

  async findPublic(options: PresetSearchOptions = {}): Promise<Preset[]> {
    const { limit = 20 } = options

    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.dynamodb.tableName,
        IndexName: 'PublicIndex', // GSI on isPublic
        KeyConditionExpression: '#isPublic = :isPublic',
        ExpressionAttributeNames: { '#isPublic': 'isPublic' },
        ExpressionAttributeValues: { ':isPublic': true },
        Limit: limit,
        ScanIndexForward: false
      }))

      return (result.Items || []) as Preset[]
    } catch (error) {
      // Fallback to scan
      return this.searchByAttribute('isPublic', true, limit)
    }
  }

  async findFeatured(options: PresetSearchOptions = {}): Promise<Preset[]> {
    const { limit = 20 } = options

    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.dynamodb.tableName,
        IndexName: 'FeaturedIndex', // GSI on isFeatured
        KeyConditionExpression: '#isFeatured = :isFeatured',
        ExpressionAttributeNames: { '#isFeatured': 'isFeatured' },
        ExpressionAttributeValues: { ':isFeatured': true },
        Limit: limit,
        ScanIndexForward: false
      }))

      return (result.Items || []) as Preset[]
    } catch (error) {
      // Fallback to scan
      return this.searchByAttribute('isFeatured', true, limit)
    }
  }

  async findByTags(tags: string[], options: PresetSearchOptions = {}): Promise<Preset[]> {
    const filters: PresetSearchFilters = { tags }
    const result = await this.search(filters, options)
    return result.presets
  }

  // User interactions
  async addInteraction(interaction: PresetInteraction): Promise<void> {
    try {
      await this.dynamoClient.send(new PutCommand({
        TableName: `${this.config.dynamodb.tableName}-interactions`,
        Item: interaction
      }))
    } catch (error) {
      throw new PresetStorageError('Failed to add interaction', error)
    }
  }

  async getAnalytics(presetId: string): Promise<PresetAnalytics> {
    try {
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: `${this.config.dynamodb.tableName}-analytics`,
        Key: { presetId }
      }))

      if (!result.Item) {
        // Return default analytics if none exist
        return {
          presetId,
          views: 0,
          downloads: 0,
          likes: 0,
          shares: 0,
          averageRating: 0,
          ratingCount: 0,
          popularityScore: 0,
          trendingScore: 0,
          lastUpdated: new Date().toISOString()
        }
      }

      return result.Item as PresetAnalytics
    } catch (error) {
      throw new PresetStorageError('Failed to get analytics', error)
    }
  }

  async updateAnalytics(presetId: string, updates: Partial<PresetAnalytics>): Promise<void> {
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const attr = `#${key}`
        const val = `:${key}`
        updateExpressions.push(`${attr} = ${val}`)
        expressionAttributeNames[attr] = key
        expressionAttributeValues[val] = value
      }
    })

    if (updateExpressions.length === 0) {
      return
    }

    // Always update lastUpdated
    updateExpressions.push('#lastUpdated = :lastUpdated')
    expressionAttributeNames['#lastUpdated'] = 'lastUpdated'
    expressionAttributeValues[':lastUpdated'] = new Date().toISOString()

    try {
      await this.dynamoClient.send(new UpdateCommand({
        TableName: `${this.config.dynamodb.tableName}-analytics`,
        Key: { presetId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      }))
    } catch (error) {
      throw new PresetStorageError('Failed to update analytics', error)
    }
  }

  // Asset management
  async uploadThumbnail(presetId: string, file: Buffer, mimeType: string): Promise<string> {
    const key = `presets/${presetId}/thumbnail.${this.getFileExtension(mimeType)}`
    
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.config.s3.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
        ACL: 'public-read'
      }))

      return `https://${this.config.s3.bucketName}.s3.${this.config.s3.region}.amazonaws.com/${key}`
    } catch (error) {
      throw new PresetStorageError('Failed to upload thumbnail', error)
    }
  }

  async uploadPreview(presetId: string, file: Buffer, mimeType: string): Promise<string> {
    const key = `presets/${presetId}/preview.${this.getFileExtension(mimeType)}`
    
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.config.s3.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
        ACL: 'public-read'
      }))

      return `https://${this.config.s3.bucketName}.s3.${this.config.s3.region}.amazonaws.com/${key}`
    } catch (error) {
      throw new PresetStorageError('Failed to upload preview', error)
    }
  }

  async deleteAssets(presetId: string): Promise<void> {
    const keys = [
      `presets/${presetId}/thumbnail.jpg`,
      `presets/${presetId}/thumbnail.png`,
      `presets/${presetId}/preview.jpg`,
      `presets/${presetId}/preview.png`,
      `presets/${presetId}/preview.mp4`
    ]

    try {
      // Delete all possible asset files
      await Promise.all(keys.map(key =>
        this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.config.s3.bucketName,
          Key: key
        }))
      ))
    } catch (error) {
      // Don't throw on asset deletion errors, just log
      console.warn('Failed to delete some assets:', error)
    }
  }

  // Private helper methods
  private validateConfig(config: PresetStorageConfig): void {
    if (!config.dynamodb?.tableName || !config.dynamodb?.region) {
      throw new Error('Invalid configuration: DynamoDB settings required')
    }
    if (!config.s3?.bucketName || !config.s3?.region) {
      throw new Error('Invalid configuration: S3 settings required')
    }
  }

  private validateCreateInput(input: PresetCreateInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new PresetValidationError('Preset name is required')
    }
    if (input.name.length > 100) {
      throw new PresetValidationError('Preset name too long (max 100 characters)')
    }
    if (input.description && input.description.length > 500) {
      throw new PresetValidationError('Preset description too long (max 500 characters)')
    }
    if (!input.layers || !Array.isArray(input.layers)) {
      throw new PresetValidationError('Preset layers must be an array')
    }
    if (!input.globalSettings) {
      throw new PresetValidationError('Global settings are required')
    }
  }

  private validateUpdateInput(input: PresetUpdateInput): void {
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        throw new PresetValidationError('Preset name cannot be empty')
      }
      if (input.name.length > 100) {
        throw new PresetValidationError('Preset name too long (max 100 characters)')
      }
    }
    if (input.description !== undefined && input.description.length > 500) {
      throw new PresetValidationError('Preset description too long (max 500 characters)')
    }
  }

  private async searchByAttribute(attribute: string, value: any, limit: number): Promise<Preset[]> {
    const result = await this.dynamoClient.send(new ScanCommand({
      TableName: this.config.dynamodb.tableName,
      FilterExpression: `#attr = :value`,
      ExpressionAttributeNames: { '#attr': attribute },
      ExpressionAttributeValues: { ':value': value },
      Limit: limit
    }))

    return (result.Items || []) as Preset[]
  }

  private getSortValue(preset: Preset, sortBy: string): any {
    switch (sortBy) {
      case 'createdAt':
      case 'updatedAt':
        return new Date(preset[sortBy as keyof Preset] as string).getTime()
      case 'downloadCount':
      case 'likeCount':
        return preset[sortBy as keyof Preset] as number
      case 'name':
        return preset.name.toLowerCase()
      default:
        return preset.createdAt
    }
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav'
    }
    return extensions[mimeType] || 'bin'
  }
}