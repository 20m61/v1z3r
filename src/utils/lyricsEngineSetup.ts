/**
 * Setup for lyrics-engine module integration
 * Connects the lyrics-engine to the main app's store and components
 */

import { setLyricsStoreProvider } from '@vj-app/lyrics-engine/dist/hooks/useLyricsStore';
import { registerUIComponents } from '@vj-app/lyrics-engine/dist/components/ui';
import { useVisualizerStore } from '@/store/visualizerStore';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import ColorPicker from '@/components/ui/ColorPicker';

export function setupLyricsEngine() {
  // Connect the store
  setLyricsStoreProvider(() => {
    const store = useVisualizerStore.getState();
    return {
      isLyricsEnabled: store.isLyricsEnabled,
      setLyricsEnabled: store.setLyricsEnabled,
      lyricsFont: store.lyricsFont,
      setLyricsFont: store.setLyricsFont,
      lyricsAnimation: store.lyricsAnimation,
      setLyricsAnimation: store.setLyricsAnimation,
      lyricsColor: store.lyricsColor,
      setLyricsColor: store.setLyricsColor,
      lyricsSize: store.lyricsSize,
      setLyricsSize: store.setLyricsSize,
      lyricsOpacity: store.lyricsOpacity,
      setLyricsOpacity: store.setLyricsOpacity,
      recognitionLanguage: store.recognitionLanguage,
      setRecognitionLanguage: store.setRecognitionLanguage,
      isListening: store.isListening,
      setIsListening: store.setIsListening,
    };
  });

  // Register UI components
  registerUIComponents({
    Button,
    Slider,
    ColorPicker,
  });
}