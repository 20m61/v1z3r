/**
 * Unified Controller exports
 */

export { UnifiedController } from './UnifiedController';
export type { 
  UnifiedControllerProps,
  UnifiedControllerState,
  ControllerActions,
  LayerState,
  EffectChain,
  Effect,
  PresetConfig,
  BeatInfo
} from './types';
export { useUnifiedControllerStore } from '../../store/unifiedControllerStore';