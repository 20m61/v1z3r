# Visual Renderer Module

## Overview
The visual renderer module handles the display page functionality for the VJ application, providing high-performance visual effects using WebGL2 and Three.js.

## Features
- **Audio-reactive visuals**: Real-time visual response to audio input using Web Audio API
- **MIDI integration**: Support for MIDI controllers via Web MIDI API
- **Shader effects**: Custom GLSL shaders for advanced visual effects
- **Parameter control**: Real-time parameter updates from controller module
- **Preset system**: Load and switch between visual presets
- **Performance optimization**: Optimized rendering pipeline for live performance

## Tech Stack
- WebGL2
- Three.js
- GLSL Shaders
- Pixi.js (for 2D effects)
- Web Audio API
- Web MIDI API

## Structure
```
visual-renderer/
├── src/
│   ├── core/           # Core rendering engine
│   ├── effects/        # Visual effect implementations
│   ├── shaders/        # GLSL shader files
│   ├── audio/          # Audio analysis utilities
│   ├── midi/           # MIDI input handling
│   └── presets/        # Visual preset definitions
├── public/             # Static assets
└── package.json        # Dependencies
```

## Getting Started
TODO: Implementation details to be added during development.