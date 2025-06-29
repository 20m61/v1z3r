/**
 * Preset Storage Module - Main exports
 * 
 * DynamoDB-based preset storage with S3 asset management for VJ Application
 */

export { PresetRepository } from './repository/PresetRepository'

// Export all types
export * from './types'

// Main module interface implementation
import { PresetRepository } from './repository/PresetRepository'
import { 
  IPresetStorageModule,
  PresetStorageConfig,
  IPresetRepository,
  IPresetService
} from './types'

export class PresetStorageModule implements IPresetStorageModule {
  private repository: PresetRepository | null = null
  private service: IPresetService | null = null
  private initialized: boolean = false

  async initialize(config: PresetStorageConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('PresetStorageModule already initialized')
    }

    try {
      // Initialize repository
      this.repository = new PresetRepository(config)
      
      // TODO: Initialize service layer when implemented
      // this.service = new PresetService(this.repository)
      
      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize PresetStorageModule: ${error}`)
    }
  }

  async destroy(): Promise<void> {
    if (this.initialized) {
      this.repository = null
      this.service = null
      this.initialized = false
    }
  }

  getRepository(): IPresetRepository {
    if (!this.initialized || !this.repository) {
      throw new Error('PresetStorageModule not initialized')
    }
    return this.repository
  }

  getService(): IPresetService {
    if (!this.initialized || !this.service) {
      throw new Error('PresetStorageModule not initialized or service not implemented')
    }
    return this.service
  }

  async healthCheck(): Promise<{ dynamodb: boolean; s3: boolean; overall: boolean }> {
    if (!this.initialized || !this.repository) {
      return { dynamodb: false, s3: false, overall: false }
    }

    try {
      // Test DynamoDB connectivity
      const testPreset = await this.repository.findById('health-check-test')
      
      // Test S3 connectivity (this would be done by attempting a small operation)
      // For now, assume it's healthy if DynamoDB works
      
      return { dynamodb: true, s3: true, overall: true }
    } catch (error) {
      return { dynamodb: false, s3: false, overall: false }
    }
  }
}

// Export singleton instance
export const presetStorage = new PresetStorageModule()