export interface Feature {
  id: string
  title: string
  category: string
  description: string
  details: string[]
  screenshot?: string
  icon: string
}

export const features: Feature[] = [
  // Audio Processing Features
  {
    id: 'fft-analysis',
    title: 'FFT Analysis',
    category: 'Audio Processing',
    description: 'Real-time Fast Fourier Transform analysis for precise frequency detection',
    details: [
      '1024-point FFT with configurable window size',
      'Frequency band isolation (bass, mids, highs)',
      'Spectral smoothing and peak detection',
      'Real-time waveform visualization',
      'Customizable frequency ranges',
    ],
    icon: '📊',
  },
  {
    id: 'beat-detection',
    title: 'Advanced Beat Detection',
    category: 'Audio Processing',
    description: 'AI-enhanced beat detection with LSTM neural networks',
    details: [
      'Machine learning-based tempo detection',
      'Onset detection with adaptive threshold',
      'Beat grid synchronization',
      'Manual tap tempo override',
      'Multi-band beat analysis',
    ],
    icon: '🥁',
  },
  {
    id: 'ai-music-analysis',
    title: 'AI Music Analysis',
    category: 'Audio Processing',
    description: 'Intelligent music understanding using TensorFlow.js',
    details: [
      'Key and scale detection',
      'Mood and energy analysis',
      'Genre classification',
      'Song structure detection (verse, chorus, bridge)',
      'Automatic parameter suggestions',
    ],
    icon: '🧠',
  },

  // Visual Effects Features
  {
    id: 'webgl-effects',
    title: 'WebGL Visual Effects',
    category: 'Visual Effects',
    description: 'Hardware-accelerated visual effects powered by Three.js',
    details: [
      'Particle systems (up to 100k particles)',
      'Shader-based effects',
      'Real-time geometry manipulation',
      'Texture effects and filters',
      'Custom shader support',
    ],
    icon: '✨',
  },
  {
    id: 'webgpu-compute',
    title: 'WebGPU Compute Shaders',
    category: 'Visual Effects',
    description: 'Next-generation GPU compute capabilities',
    details: [
      'Parallel particle simulation',
      'GPU-based physics',
      'Advanced fluid dynamics',
      'Real-time ray marching',
      'Automatic WebGL fallback',
    ],
    icon: '🚀',
  },
  {
    id: 'post-processing',
    title: 'Post-Processing Pipeline',
    category: 'Visual Effects',
    description: 'Professional-grade post-processing effects',
    details: [
      'Bloom and glow effects',
      'Screen-space ambient occlusion (SSAO)',
      'Motion blur and depth of field',
      'Chromatic aberration',
      'Color grading and tone mapping',
    ],
    icon: '🎨',
  },
  {
    id: 'layer-system',
    title: 'Advanced Layer System',
    category: 'Visual Effects',
    description: 'Compositing system with blend modes and effects',
    details: [
      'Unlimited layers with opacity control',
      '20+ blend modes',
      'Layer masks and effects',
      'Group layers with nested effects',
      'Real-time preview',
    ],
    icon: '📚',
  },

  // Control Features
  {
    id: 'ui-controls',
    title: 'Intuitive UI Controls',
    category: 'Control',
    description: 'Touch-optimized interface for live performance',
    details: [
      'Responsive design for all screen sizes',
      'Touch-friendly sliders and knobs',
      'Tabbed interface organization',
      'Real-time parameter feedback',
      'Customizable layouts',
    ],
    icon: '🎛️',
  },
  {
    id: 'midi-support',
    title: 'Professional MIDI Support',
    category: 'Control',
    description: 'Industry-standard MIDI controller integration',
    details: [
      'Auto-detection of MIDI devices',
      'Velocity and pressure sensitivity',
      'RGB LED feedback support',
      'Custom MIDI mapping',
      'Popular controller presets',
    ],
    icon: '🎹',
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Comprehensive Shortcuts',
    category: 'Control',
    description: 'Keyboard shortcuts for rapid control',
    details: [
      '50+ keyboard shortcuts',
      'Customizable key bindings',
      'Context-sensitive commands',
      'Macro support',
      'Shortcut cheat sheet overlay',
    ],
    icon: '⌨️',
  },

  // AI Features
  {
    id: 'style-transfer',
    title: 'AI Style Transfer',
    category: 'AI Features',
    description: 'Real-time neural style transfer for unique visuals',
    details: [
      'Pre-trained style models',
      'Custom style training',
      'Intensity control',
      'Multiple style blending',
      'Music-reactive style switching',
    ],
    icon: '🎭',
  },
  {
    id: 'auto-vj',
    title: 'Intelligent Auto-VJ',
    category: 'AI Features',
    description: 'AI-powered automatic visual generation',
    details: [
      'Music-driven parameter automation',
      'Intelligent effect selection',
      'Mood-based color schemes',
      'Automatic transition timing',
      'Learning from user preferences',
    ],
    icon: '🤖',
  },
  {
    id: 'visual-mapping',
    title: 'Smart Visual Mapping',
    category: 'AI Features',
    description: 'Automatic audio-to-visual parameter mapping',
    details: [
      'Frequency-to-parameter mapping',
      'Energy-based intensity control',
      'Rhythm-synchronized effects',
      'Dynamic range optimization',
      'Custom mapping curves',
    ],
    icon: '🔄',
  },

  // Collaboration Features
  {
    id: 'websocket-sync',
    title: 'Real-time Synchronization',
    category: 'Collaboration',
    description: 'WebSocket-based multi-device sync',
    details: [
      'Low-latency parameter sync',
      'Room-based sessions',
      'Automatic reconnection',
      'Conflict resolution',
      'Bandwidth optimization',
    ],
    icon: '🔗',
  },
  {
    id: 'preset-sharing',
    title: 'Cloud Preset Storage',
    category: 'Collaboration',
    description: 'AWS-powered preset management system',
    details: [
      'Unlimited preset storage',
      'Version control',
      'Collaborative editing',
      'Public/private sharing',
      'Preset marketplace',
    ],
    icon: '☁️',
  },
  {
    id: 'live-streaming',
    title: 'Live Performance Mode',
    category: 'Collaboration',
    description: 'Optimized for live streaming and recording',
    details: [
      'OBS Studio integration',
      'Syphon/Spout output',
      'NDI support',
      'Multi-output routing',
      'Performance recording',
    ],
    icon: '📡',
  },

  // Technical Features
  {
    id: 'modular-architecture',
    title: 'Modular Architecture',
    category: 'Technical',
    description: 'Six independent modules for maximum flexibility',
    details: [
      'visual-renderer: WebGL rendering engine',
      'vj-controller: React control interface',
      'sync-core: WebSocket synchronization',
      'preset-storage: AWS storage integration',
      'lyrics-engine: Speech recognition',
      'mcp-integration: External tool support',
    ],
    icon: '📦',
  },
  {
    id: 'performance-optimization',
    title: 'Performance Optimization',
    category: 'Technical',
    description: 'Advanced optimization for smooth 60fps performance',
    details: [
      'Memory pooling and recycling',
      'GPU resource management',
      'Automatic quality scaling',
      'Frame skip prevention',
      'Battery usage optimization',
    ],
    icon: '⚡',
  },
  {
    id: 'error-handling',
    title: 'Production Error Handling',
    category: 'Technical',
    description: 'Comprehensive error handling and monitoring',
    details: [
      'Graceful degradation',
      'Error boundary protection',
      'Performance monitoring',
      'Crash reporting',
      'Debug overlay',
    ],
    icon: '🛡️',
  },
]

export function getFeaturesByCategory(category: string): Feature[] {
  return features.filter(f => f.category === category)
}

export function getFeatureById(id: string): Feature | undefined {
  return features.find(f => f.id === id)
}

export const categories = Array.from(new Set(features.map(f => f.category)))