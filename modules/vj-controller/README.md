# VJ Controller Module

## Overview
The VJ controller module provides the control interface for managing visual effects, audio parameters, and device synchronization.

## Features
- **Voice recognition**: Hands-free control using Web Speech Recognition API
- **Parameter UI**: Intuitive interface for real-time parameter adjustment
- **Preset management**: Save, load, and organize visual presets
- **MIDI bridge**: Route MIDI input to visual renderer
- **Device sync**: Manage connections with multiple display devices
- **Touch optimization**: Optimized for mobile touch interfaces

## Tech Stack
- React
- Next.js
- Tailwind CSS
- Web Speech Recognition API
- WebSocket (for device communication)
- LocalStorage + DynamoDB sync

## Structure
```
vj-controller/
├── src/
│   ├── components/     # React components
│   │   ├── controls/   # Parameter control widgets
│   │   ├── presets/    # Preset management UI
│   │   ├── voice/      # Voice recognition interface
│   │   └── sync/       # Device synchronization UI
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API and WebSocket services
│   └── utils/          # Utility functions
├── public/             # Static assets
└── package.json        # Dependencies
```

## Getting Started
TODO: Implementation details to be added during development.