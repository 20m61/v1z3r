/**
 * Hook to connect lyrics-engine to the main app's store
 * This provides a layer of abstraction
 */

import { LyricsStore } from '../types';

let storeProvider: (() => LyricsStore) | null = null;

export function setLyricsStoreProvider(provider: () => LyricsStore) {
  storeProvider = provider;
}

export function useLyricsStore(): LyricsStore {
  if (!storeProvider) {
    // Return a mock store for testing or standalone usage
    return {
      isLyricsEnabled: false,
      setLyricsEnabled: () => {},
      lyricsFont: 'futuristic',
      setLyricsFont: () => {},
      lyricsAnimation: 'fade',
      setLyricsAnimation: () => {},
      lyricsColor: '#ffffff',
      setLyricsColor: () => {},
      lyricsSize: 24,
      setLyricsSize: () => {},
      lyricsOpacity: 0.9,
      setLyricsOpacity: () => {},
      recognitionLanguage: 'en-US',
      setRecognitionLanguage: () => {},
      isListening: false,
      setIsListening: () => {},
      currentLyrics: '',
      nextLyrics: '',
      lyricsHistory: [],
      updateCurrentLyrics: () => {},
      updateNextLyrics: () => {},
      lyricsConfidence: 0,
      clearLyricsHistory: () => {},
    };
  }
  
  return storeProvider();
}