export interface Shortcut {
  key: string
  description: string
  category: string
  modifier?: string[]
}

export const shortcuts: Shortcut[] = [
  // General Controls
  {
    key: 'Space',
    description: 'Play/Pause visualization',
    category: 'General',
  },
  {
    key: 'R',
    description: 'Reset all parameters to default',
    category: 'General',
  },
  {
    key: 'F',
    description: 'Toggle fullscreen mode',
    category: 'General',
  },
  {
    key: 'H',
    description: 'Show/Hide control panel',
    category: 'General',
  },
  
  // Effect Controls
  {
    key: '1-9',
    description: 'Quick switch between effect presets',
    category: 'Effects',
  },
  {
    key: 'Q',
    description: 'Previous effect',
    category: 'Effects',
  },
  {
    key: 'E',
    description: 'Next effect',
    category: 'Effects',
  },
  {
    key: 'I',
    description: 'Increase effect intensity',
    category: 'Effects',
  },
  {
    key: 'O',
    description: 'Decrease effect intensity',
    category: 'Effects',
  },
  
  // Layer Management
  {
    key: 'L',
    description: 'Add new layer',
    category: 'Layers',
    modifier: ['Ctrl/Cmd'],
  },
  {
    key: 'Delete',
    description: 'Remove selected layer',
    category: 'Layers',
  },
  {
    key: '↑/↓',
    description: 'Navigate between layers',
    category: 'Layers',
  },
  {
    key: 'V',
    description: 'Toggle layer visibility',
    category: 'Layers',
  },
  {
    key: 'B',
    description: 'Change layer blend mode',
    category: 'Layers',
  },
  
  // Audio Controls
  {
    key: 'M',
    description: 'Mute/Unmute audio input',
    category: 'Audio',
  },
  {
    key: '+/-',
    description: 'Adjust audio sensitivity',
    category: 'Audio',
  },
  {
    key: 'A',
    description: 'Toggle audio reactivity',
    category: 'Audio',
  },
  {
    key: 'T',
    description: 'Tap tempo (manual BPM)',
    category: 'Audio',
  },
  
  // Preset Management
  {
    key: 'S',
    description: 'Save current preset',
    category: 'Presets',
    modifier: ['Ctrl/Cmd'],
  },
  {
    key: 'O',
    description: 'Open preset',
    category: 'Presets',
    modifier: ['Ctrl/Cmd'],
  },
  {
    key: '[',
    description: 'Previous preset',
    category: 'Presets',
  },
  {
    key: ']',
    description: 'Next preset',
    category: 'Presets',
  },
  
  // Recording & Export
  {
    key: 'R',
    description: 'Start/Stop recording',
    category: 'Recording',
    modifier: ['Ctrl/Cmd', 'Shift'],
  },
  {
    key: 'P',
    description: 'Take screenshot',
    category: 'Recording',
    modifier: ['Ctrl/Cmd'],
  },
  
  // AI Features
  {
    key: 'G',
    description: 'Toggle AI auto-generation',
    category: 'AI',
    modifier: ['Ctrl/Cmd'],
  },
  {
    key: 'N',
    description: 'Generate new AI style',
    category: 'AI',
  },
  {
    key: 'U',
    description: 'Update AI parameters',
    category: 'AI',
  },
  
  // WebGPU/Performance
  {
    key: 'D',
    description: 'Toggle debug overlay',
    category: 'Debug',
    modifier: ['Ctrl/Cmd', 'Shift'],
  },
  {
    key: 'F',
    description: 'Show FPS counter',
    category: 'Debug',
    modifier: ['Shift'],
  },
  {
    key: 'W',
    description: 'Toggle WebGPU/WebGL renderer',
    category: 'Debug',
    modifier: ['Ctrl/Cmd', 'Alt'],
  },
]

export const midiMappings = [
  {
    controller: 'Pioneer DDJ',
    mappings: [
      { control: 'Jog Wheel', function: 'Scratch/Seek through effects' },
      { control: 'Channel Faders', function: 'Layer opacity control' },
      { control: 'EQ Knobs', function: 'Effect parameters (High/Mid/Low)' },
      { control: 'Loop Controls', function: 'Loop visual sequences' },
      { control: 'Performance Pads', function: 'Trigger effect presets' },
    ],
  },
  {
    controller: 'Novation Launchpad',
    mappings: [
      { control: 'Grid Pads', function: 'Effect selection and triggering' },
      { control: 'Function Buttons', function: 'Layer management' },
      { control: 'Scene Launch', function: 'Preset switching' },
      { control: 'RGB Feedback', function: 'Visual state indication' },
    ],
  },
  {
    controller: 'Native Instruments Maschine',
    mappings: [
      { control: 'Velocity Pads', function: 'Intensity-based effect triggering' },
      { control: 'Encoders', function: 'Precise parameter control' },
      { control: 'Transport', function: 'Playback control' },
      { control: 'Groups', function: 'Layer selection' },
    ],
  },
  {
    controller: 'Ableton Push',
    mappings: [
      { control: 'Touch Strip', function: 'Effect intensity/pitch bend' },
      { control: 'Pressure Pads', function: 'Pressure-sensitive effects' },
      { control: 'Display', function: 'Parameter visualization' },
      { control: 'Encoders', function: 'Multi-parameter control' },
    ],
  },
]

export function getShortcutsByCategory(category: string): Shortcut[] {
  return shortcuts.filter(s => s.category === category)
}

export function formatShortcut(shortcut: Shortcut): string {
  const keys = [...(shortcut.modifier || []), shortcut.key]
  return keys.join(' + ')
}