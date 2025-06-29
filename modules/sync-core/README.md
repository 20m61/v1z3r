# Sync Core Module

## Overview
The sync core module handles real-time synchronization between multiple devices, enabling seamless parameter sharing and session management.

## Features
- **WebSocket communication**: Real-time bidirectional communication
- **Session management**: Handle multiple devices in a single session
- **Parameter broadcasting**: Sync visual parameters across devices
- **Connection recovery**: Automatic reconnection and heartbeat monitoring
- **State synchronization**: Maintain consistent state across all connected devices
- **Conflict resolution**: Handle simultaneous parameter changes

## Tech Stack
- WebSocket API
- AWS API Gateway (WebSocket)
- AWS Lambda
- DynamoDB (session storage)
- DynamoDB Streams (real-time updates)

## Structure
```
sync-core/
├── src/
│   ├── client/         # Client-side WebSocket handling
│   ├── server/         # Server-side Lambda functions
│   ├── models/         # Data models and types
│   └── utils/          # Utility functions
├── lambda/             # AWS Lambda function code
└── package.json        # Dependencies
```

## Architecture
```
[VJ Controller] ←→ [API Gateway WebSocket] ←→ [Lambda] ←→ [DynamoDB]
                                ↕
[Visual Renderer] ←→ [API Gateway WebSocket] ←→ [Lambda] ←→ [DynamoDB]
```

## Getting Started
TODO: Implementation details to be added during development.