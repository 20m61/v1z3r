# Migration Guide: AI and WebGPU Features

This guide helps you upgrade your v1z3r installation to use the new AI-powered features and WebGPU acceleration.

## Prerequisites

### System Requirements
- **Browser**: Chrome 113+, Edge 113+, or Safari 17+ (for WebGPU support)
- **Hardware**: GPU with WebGPU support (automatic WebGL fallback available)
- **MIDI**: Web MIDI API support for controller integration
- **Audio**: Microphone access for real-time audio analysis

### Dependencies Update

Update your `package.json`:

```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.17.0",
    "@tensorflow/tfjs-backend-webgl": "^4.17.0",
    "@tensorflow/tfjs-backend-webgpu": "^4.17.0",
    "three": "^0.160.0"
  }
}
```

Run:
```bash
yarn install
```

## Migration Steps

### 1. Update Visualizer Integration

Replace basic visualizer with AI VJ Master:

#### Before:
```typescript
import { Visualizer } from '@/components/Visualizer';

<Visualizer 
  audioContext={audioContext}
  isPlaying={isPlaying}
/>
```

#### After:
```typescript
import { createAIVJMaster } from '@/utils/aiVJMaster';

const vjMaster = await createAIVJMaster({
  canvas: canvasElement,
  audioContext,
  enableWebGPU: true,
  enableAI: true,
  enableMIDI: true,
});
```

### 2. Audio Processing Migration

#### Before:
```typescript
// Basic FFT analysis
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);
```

#### After:
```typescript
// AI-enhanced music analysis
import { AIMusicalAnalyzer } from '@/utils/aiMusicAnalyzer';

const analyzer = new AIMusicalAnalyzer(audioContext);
await analyzer.initialize();

const visualParams = await analyzer.analyzeRealtime();
const musicFeatures = analyzer.getCurrentFeatures();
```

### 3. Visual Effects Migration

#### Before:
```typescript
// Basic Three.js effects
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
```

#### After:
```typescript
// WebGPU particle system with post-processing
import { createWebGPUParticleSystem } from '@/utils/webgpuParticles';
import { createPostProcessingPipeline } from '@/utils/postProcessingPipeline';

const particleSystem = await createWebGPUParticleSystem(
  canvas, device, capabilities, {
    maxParticles: 100000,
    audioReactivity: 1.0,
  }
);

const postProcessing = createPostProcessingPipeline(
  renderer, scene, camera, {
    enableBloom: true,
    enableSSAO: true,
    audioReactivity: 1.5,
  }
);
```

### 4. MIDI Controller Integration

Add MIDI support to your application:

```typescript
import { createProfessionalMIDIManager } from '@/utils/professionalMIDI';

const midiManager = await createProfessionalMIDIManager();

// Handle parameter changes
midiManager.setParameterChangeHandler((parameter, value) => {
  vjMaster.updateConfig({ [parameter]: value });
});

// Handle preset changes
midiManager.setButtonPressHandler((button, velocity) => {
  if (button.startsWith('preset_')) {
    loadPreset(button);
  }
});
```

### 5. Beat Detection Migration

#### Before:
```typescript
// Simple threshold-based beat detection
if (audioLevel > threshold) {
  onBeat();
}
```

#### After:
```typescript
// AI-enhanced beat detection
import { createAIBeatDetection } from '@/utils/aiBeatDetection';

const beatDetector = await createAIBeatDetection(audioContext, {
  enableAI: true,
  minTempo: 60,
  maxTempo: 200,
});

beatDetector.connect(audioSource);
beatDetector.start();

const syncState = beatDetector.getSyncState();
// Use syncState.beatPhase for perfect synchronization
```

## Configuration Options

### Performance Modes

```typescript
// High Quality (for powerful GPUs)
{
  performanceMode: 'quality',
  maxParticles: 100000,
  styleTransferQuality: 'high',
  enableSSAO: true,
  enableMotionBlur: true,
}

// Balanced (default)
{
  performanceMode: 'balanced',
  maxParticles: 50000,
  styleTransferQuality: 'medium',
  enableSSAO: true,
  enableMotionBlur: false,
}

// Performance (for lower-end devices)
{
  performanceMode: 'performance',
  maxParticles: 10000,
  styleTransferQuality: 'low',
  enableSSAO: false,
  enableMotionBlur: false,
}
```

### AI Features Toggle

```typescript
// Enable/disable specific AI features
{
  enableAI: true,              // Master AI toggle
  enableStyleTransfer: true,   // AI style transfer
  aiUpdateInterval: 100,       // AI update rate (ms)
  confidenceThreshold: 0.7,    // AI confidence threshold
}
```

## Troubleshooting

### WebGPU Not Available

The system automatically falls back to WebGL. To check:

```typescript
import { webgpuDetector } from '@/utils/webgpuDetection';

const detection = await webgpuDetector.detect();
console.log('WebGPU supported:', detection.isSupported);
console.log('Fallback reasons:', detection.unsupportedReasons);
```

### Performance Issues

1. **Reduce particle count**:
   ```typescript
   vjMaster.updateConfig({ maxParticles: 10000 });
   ```

2. **Disable expensive effects**:
   ```typescript
   vjMaster.updateConfig({
     enableSSAO: false,
     enableMotionBlur: false,
     styleTransferQuality: 'low',
   });
   ```

3. **Use performance mode**:
   ```typescript
   vjMaster.updateConfig({ performanceMode: 'performance' });
   ```

### MIDI Controller Not Detected

1. Check browser permissions:
   ```typescript
   try {
     await navigator.requestMIDIAccess({ sysex: true });
   } catch (error) {
     console.error('MIDI access denied');
   }
   ```

2. Verify controller is connected before starting the app
3. Check supported controller list in documentation

### AI Model Loading Issues

1. Check network connectivity
2. Verify TensorFlow.js is properly installed
3. System continues with rule-based fallback if AI fails

## Best Practices

### 1. Progressive Enhancement
```typescript
// Start with basic features, add advanced ones progressively
const config = {
  enableWebGPU: await webgpuDetector.isSupported(),
  enableAI: true, // Has automatic fallback
  enableMIDI: 'requestMIDIAccess' in navigator,
};
```

### 2. Resource Management
```typescript
// Always dispose resources when done
vjMaster.dispose();
particleSystem.dispose();
beatDetector.dispose();
```

### 3. Error Handling
```typescript
try {
  const vjMaster = await createAIVJMaster(config);
} catch (error) {
  console.error('Failed to initialize:', error);
  // Fallback to basic visualizer
}
```

### 4. Performance Monitoring
```typescript
// Monitor and adapt to performance
setInterval(() => {
  const metrics = vjMaster.getPerformanceMetrics();
  if (metrics.fps < 30) {
    vjMaster.updateConfig({ performanceMode: 'performance' });
  }
}, 5000);
```

## API Compatibility

The new AI VJ Master is designed to be backward compatible. Existing visualizer code continues to work, with new features available as progressive enhancements.

### Breaking Changes
- None for existing features
- New features require updated imports

### Deprecations
- Basic `Visualizer` component (still functional but consider upgrading)
- Simple FFT analysis (replaced by comprehensive music analysis)

## Support

For issues or questions:
1. Check the [Advanced Features Guide](./ADVANCED_FEATURES_GUIDE.md)
2. Review test files for implementation examples
3. Open an issue on GitHub with the `ai-webgpu` tag

## Next Steps

1. Try the demo at `/demo/ai-vj`
2. Experiment with different AI styles
3. Connect MIDI controllers for live performance
4. Customize visual parameters for your needs

The new AI and WebGPU features transform v1z3r into a professional-grade VJ application ready for live performances and installations.