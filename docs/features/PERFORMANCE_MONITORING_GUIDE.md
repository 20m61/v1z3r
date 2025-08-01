# V1Z3R Performance Monitoring User Guide

## Overview

The V1Z3R Performance Monitoring System provides real-time insights into your application's performance during live VJ sessions. This comprehensive guide will help you understand and utilize all features to ensure optimal performance.

---

## 🚀 Getting Started

### Automatic Initialization
The performance monitoring system starts automatically when V1Z3R loads. No manual configuration is required for basic functionality.

### Accessing the Dashboard
There are multiple ways to open the performance dashboard:

1. **Keyboard Shortcut**: Press `P` to toggle the dashboard
2. **UI Button**: Click the 📊 button in the control panel
3. **Programmatically**: Use the store action `togglePerformanceDashboard()`
4. **Auto-show**: Dashboard automatically appears during critical performance issues

---

## 📊 Dashboard Interface

### Overview Tab
The main view displays three real-time charts:

#### FPS Chart
- **Green Zone (60+ FPS)**: Optimal performance
- **Yellow Zone (30-60 FPS)**: Acceptable performance
- **Red Zone (<30 FPS)**: Poor performance requiring attention
- **Dropped Frames**: Indicated by red markers on the timeline

#### Memory Chart
- **Heap Usage**: JavaScript memory consumption
- **Memory Pressure**: Color-coded indicator (green/yellow/red)
- **Resource Counts**: Textures, geometries, and materials in use
- **Leak Detection**: Automatic alerts for suspected memory leaks

#### Audio Latency Chart
- **Latency Timeline**: Real-time audio delay measurement
- **Context State**: Shows if audio is running, suspended, or closed
- **Buffer Underruns**: Indicates audio glitches
- **Target Line**: Displays current quality profile's target latency

### Quality Controls Tab
Manual controls for performance optimization:

- **Quality Profile Selector**: Choose from 5 presets
  - **Ultra Low (Potato)**: For severely limited devices
  - **Low**: For older mobile devices
  - **Medium**: Balanced performance (default)
  - **High**: For powerful desktop systems
  - **Ultra**: Maximum quality for high-end hardware

- **Adaptive Quality Toggle**: Enable/disable automatic optimization
- **Device Info**: Shows detected hardware capabilities

### Alerts Tab
Performance alert management:

- **Active Alerts**: List of current performance issues
- **Severity Levels**:
  - 🔵 **Info**: Informational notices
  - 🟡 **Warning**: Performance degradation detected
  - 🔴 **Critical**: Immediate attention required
- **Actions**: Acknowledge or resolve alerts
- **Alert History**: Track resolved issues

---

## 🎯 Quality Profiles

### Profile Specifications

| Profile | Render Scale | Particles | Effects | FPS Target | Audio Buffer |
|---------|-------------|-----------|---------|------------|--------------|
| Ultra Low | 0.5x | 100 | Minimal | 30 | 512ms |
| Low | 0.75x | 500 | Basic | 45 | 256ms |
| Medium | 1.0x | 1,000 | Standard | 60 | 128ms |
| High | 1.25x | 2,000 | Enhanced | 60 | 64ms |
| Ultra | 1.5x | 5,000 | Maximum | 60 | 32ms |

### Automatic Adaptation
The system automatically adjusts quality based on:

- **FPS Drop**: Reduces quality when FPS falls below target
- **Memory Pressure**: Lowers settings when memory usage exceeds 75%
- **Audio Issues**: Increases buffer size on audio underruns
- **Battery Level**: Conserves power on mobile devices below 20%
- **Temperature**: Reduces load on thermal throttling (mobile)

---

## 📱 Mobile Optimization

### Mobile-Specific Features
- **Compact Dashboard**: Automatically switches to mobile layout
- **Touch Controls**: Swipe gestures for dashboard navigation
- **Battery Monitoring**: Real-time battery level tracking
- **Network Status**: Connection quality indicators
- **Reduced Logging**: Minimal console output for performance

### Best Practices for Mobile
1. Start with "Low" or "Medium" quality profiles
2. Enable adaptive quality for automatic optimization
3. Monitor battery level during extended sessions
4. Use compact dashboard mode to save screen space
5. Disable unnecessary effects when battery is low

---

## 🔧 Advanced Configuration

### Store Integration
```typescript
import { useVisualizerStore } from '@/store/visualizerStore';

const Component = () => {
  const {
    performanceMetrics,
    performanceAlerts,
    performanceProfile,
    setQualityProfile,
    togglePerformanceDashboard,
    acknowledgePerformanceAlert,
  } = useVisualizerStore();
  
  // Use performance data in your components
};
```

### Custom Alert Rules
```typescript
// Add custom alert rule
monitor.addAlert({
  id: 'custom-memory',
  name: 'Custom Memory Alert',
  metric: 'memory.heap.used',
  threshold: 400 * 1024 * 1024, // 400MB
  operator: 'gt',
  severity: 'warning',
  duration: 5000 // Sustained for 5 seconds
});
```

### Performance Metrics Access
```typescript
// Subscribe to real-time metrics
const unsubscribe = monitor.subscribe((metrics, alerts) => {
  console.log('Current FPS:', metrics.rendering.fps);
  console.log('Memory used:', metrics.memory.heap.used);
  console.log('Active alerts:', alerts.length);
});
```

---

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Toggle performance dashboard |
| `Q` | Cycle through quality profiles |
| `A` | Toggle adaptive quality |
| `C` | Switch to compact mode |
| `ESC` | Dismiss alerts / Close dashboard |

---

## 🚨 Alert Types

### FPS Alerts
- **FPS Warning**: Frame rate drops below 30 FPS
- **Critical FPS Drop**: Frame rate below 20 FPS
- **GPU Overload**: GPU frame time exceeds 16ms

### Memory Alerts
- **Memory Warning**: Usage exceeds 75% of available
- **Memory Critical**: Usage exceeds 90% of available
- **Memory Leak Suspected**: Continuous growth detected

### Audio Alerts
- **Audio Latency High**: Latency exceeds 100ms
- **Audio Buffer Underrun**: Audio glitches detected
- **Audio Context Suspended**: Audio system interrupted

### Mobile Alerts
- **Battery Low**: Battery level below 20%
- **Battery Critical**: Battery level below 10%
- **Thermal Throttling**: Device temperature high

---

## 💡 Performance Tips

### Optimizing for Live Performance
1. **Pre-show Setup**:
   - Test quality profiles before the show
   - Set conservative initial profile
   - Enable adaptive quality
   - Clear browser cache

2. **During Performance**:
   - Monitor FPS chart regularly
   - Watch for memory growth
   - Address critical alerts immediately
   - Use manual override if needed

3. **Troubleshooting**:
   - **Low FPS**: Reduce particle count or effect complexity
   - **Memory Issues**: Disable unused layers or effects
   - **Audio Glitches**: Increase audio buffer size
   - **Mobile Heat**: Lower quality profile or take breaks

### Best Practices
- Keep the dashboard in compact mode during shows
- Set up alert thresholds based on your hardware
- Test performance with your typical visual setups
- Document quality settings that work for each venue
- Have fallback profiles ready for emergencies

---

## 📈 Understanding Metrics

### FPS (Frames Per Second)
- **60 FPS**: Smooth, professional quality
- **30-60 FPS**: Acceptable for most scenarios
- **<30 FPS**: Noticeable stuttering

### Memory Usage
- **Heap Used**: Active JavaScript memory
- **Heap Total**: Allocated memory
- **GPU Memory**: Video memory usage (when available)

### Audio Latency
- **<20ms**: Imperceptible delay
- **20-50ms**: Acceptable for most uses
- **50-100ms**: Noticeable but tolerable
- **>100ms**: Problematic for live performance

---

## 🛠️ Troubleshooting

### Common Issues

**Dashboard Won't Open**
- Check if performance monitoring is initialized
- Verify no JavaScript errors in console
- Try refreshing the page

**Metrics Not Updating**
- Ensure collectors are properly initialized
- Check if monitoring is started
- Verify browser supports required APIs

**Quality Not Adapting**
- Check if adaptive quality is enabled
- Verify cooldown period has passed (5 seconds)
- Ensure quality profile changes are not locked

**Mobile Performance Issues**
- Close unnecessary background apps
- Ensure device isn't in power saving mode
- Check available storage space
- Consider using external cooling for extended sessions

---

## 📚 API Reference

### Store Actions
```typescript
initializePerformanceMonitoring(renderer?: any): Promise<void>
setQualityProfile(profileName: string): void
togglePerformanceDashboard(): void
updatePerformanceSettings(settings: Partial<PerformanceSettings>): void
acknowledgePerformanceAlert(alertId: string): void
resolvePerformanceAlert(alertId: string): void
```

### Available Metrics
```typescript
interface PerformanceSnapshot {
  timestamp: number;
  rendering: RenderingMetrics;
  memory: MemoryMetrics;
  audio: AudioMetrics;
  mobile?: MobileMetrics;
  ux: UXMetrics;
}
```

---

## 🎯 Quick Reference Card

### Performance Targets
- **FPS**: 60 (30 minimum)
- **Memory**: <500MB usage
- **Audio Latency**: <100ms
- **Load Time**: <3 seconds
- **Interaction**: <50ms response

### Emergency Actions
1. Press `Q` to quickly reduce quality
2. Press `P` to hide dashboard (saves resources)
3. Disable adaptive quality for manual control
4. Switch to "Ultra Low" profile if needed
5. Refresh page if system becomes unresponsive

---

For more information, see the [technical documentation](../development/PERFORMANCE_MONITORING_TECHNICAL.md) or [API reference](../api/performance-monitor.md).