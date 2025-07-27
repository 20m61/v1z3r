/**
 * Type definitions for lyrics-engine module
 * Re-exports from shared types module
 */

import { FontType, AnimationType } from '@vj-app/types';

// Re-export shared types
export type { FontType, AnimationType };

export interface LyricsStore {
  isLyricsEnabled: boolean;
  setLyricsEnabled: (enabled: boolean) => void;
  lyricsFont: FontType;
  setLyricsFont: (font: FontType) => void;
  lyricsAnimation: AnimationType;
  setLyricsAnimation: (animation: AnimationType) => void;
  lyricsColor: string;
  setLyricsColor: (color: string) => void;
  lyricsSize: number;
  setLyricsSize: (size: number) => void;
  lyricsOpacity: number;
  setLyricsOpacity: (opacity: number) => void;
  recognitionLanguage: string;
  setRecognitionLanguage: (language: string) => void;
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
  clearLyricsHistory?: () => void;
  currentLyrics?: string;
  nextLyrics?: string;
  lyricsHistory?: Array<{ id: string; text: string; timestamp?: number }>;
  updateCurrentLyrics?: (lyrics: string, confidence?: number) => void;
  updateNextLyrics?: (lyrics: string) => void;
  lyricsConfidence?: number;
}

// Re-export UI component types from shared module
export type { ButtonProps, SliderProps, ColorPickerProps } from '@vj-app/types';