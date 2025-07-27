/**
 * Type definitions for lyrics-engine module
 * These interfaces allow the module to be independent of the main app
 */

export type FontType = 'futuristic' | 'classic' | 'handwritten' | 'bold' | 'elegant' | 'teko' | 'prompt' | 'audiowide' | 'russo' | 'orbitron';
export type AnimationType = 'fade' | 'slide' | 'scale' | 'rotate' | 'bounce' | 'glow' | 'pulse' | 'none';

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

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
}

export interface ColorPickerProps {
  value?: string;
  color?: string; // alias for value
  onChange: (color: string) => void;
  label?: string;
  className?: string;
  presetColors?: string[];
}