/**
 * WebGPU Compatibility Checker Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { WebGPUCompatibilityChecker, useWebGPUCapabilities } from '../WebGPUCompatibilityChecker';
import { webgpuDetector } from '@/utils/webgpuDetection';
import { renderHook } from '@testing-library/react';

// Mock webgpuDetection module
jest.mock('@/utils/webgpuDetection', () => ({
  webgpuDetector: {
    detectCapabilities: jest.fn(),
  },
}));

// Mock errorHandler
jest.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCapabilitiesSupported = {
  isSupported: true,
  powerPreference: 'high-performance' as GPUPowerPreference,
  fallbackRequired: false,
  performanceRating: 'excellent' as const,
  computeShaderSupport: true,
  recommendedConfig: {
    powerPreference: 'high-performance' as GPUPowerPreference,
    forceFallbackAdapter: false,
    enableComputeShaders: true,
    maxTextureSize: 8192,
    maxBufferSize: 1024 * 1024 * 1024,
    maxComputeWorkgroupSize: 256,
    preferredFormat: 'bgra8unorm' as GPUTextureFormat,
    enableDebug: false,
  },
};

const mockCapabilitiesUnsupported = {
  isSupported: false,
  powerPreference: 'high-performance' as GPUPowerPreference,
  fallbackRequired: true,
  performanceRating: 'poor' as const,
  computeShaderSupport: false,
  recommendedConfig: {
    powerPreference: 'high-performance' as GPUPowerPreference,
    forceFallbackAdapter: false,
    enableComputeShaders: false,
    maxTextureSize: 2048,
    maxBufferSize: 128 * 1024 * 1024,
    maxComputeWorkgroupSize: 64,
    preferredFormat: 'bgra8unorm' as GPUTextureFormat,
    enableDebug: false,
  },
};

describe('WebGPUCompatibilityChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <WebGPUCompatibilityChecker>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    expect(screen.getByText('Checking WebGPU compatibility...')).toBeInTheDocument();
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('should render children when WebGPU is supported', async () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockResolvedValue(mockCapabilitiesSupported);

    render(
      <WebGPUCompatibilityChecker>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    expect(screen.queryByText('WebGPU Not Available')).not.toBeInTheDocument();
  });

  it('should show fallback when WebGPU is not supported', async () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockResolvedValue(mockCapabilitiesUnsupported);

    render(
      <WebGPUCompatibilityChecker>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    await waitFor(() => {
      expect(screen.getByText('WebGPU Not Available')).toBeInTheDocument();
    });

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    expect(screen.getByText(/Your browser does not support WebGPU/)).toBeInTheDocument();
  });

  it('should use custom fallback component', async () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockResolvedValue(mockCapabilitiesUnsupported);

    const CustomFallback = ({ capabilities }: any) => (
      <div>Custom fallback: {capabilities?.performanceRating}</div>
    );

    render(
      <WebGPUCompatibilityChecker fallback={CustomFallback}>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom fallback: poor')).toBeInTheDocument();
    });
  });

  it('should call onCapabilitiesDetected callback', async () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockResolvedValue(mockCapabilitiesSupported);

    const onCapabilitiesDetected = jest.fn();

    render(
      <WebGPUCompatibilityChecker onCapabilitiesDetected={onCapabilitiesDetected}>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    await waitFor(() => {
      expect(onCapabilitiesDetected).toHaveBeenCalledWith(mockCapabilitiesSupported);
    });
  });

  it('should handle detection errors gracefully', async () => {
    const error = new Error('Detection failed');
    (webgpuDetector.detectCapabilities as jest.Mock).mockRejectedValue(error);

    render(
      <WebGPUCompatibilityChecker>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    await waitFor(() => {
      expect(screen.getByText('WebGPU Not Available')).toBeInTheDocument();
    });
  });

  it('should show browser recommendations in fallback', async () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockResolvedValue(mockCapabilitiesUnsupported);

    render(
      <WebGPUCompatibilityChecker>
        <div>Test Content</div>
      </WebGPUCompatibilityChecker>
    );

    await waitFor(() => {
      expect(screen.getByText('Recommended Browsers')).toBeInTheDocument();
      expect(screen.getByText(/Chrome\/Edge 113\+/)).toBeInTheDocument();
      expect(screen.getByText('Enable WebGPU in Chrome')).toBeInTheDocument();
    });
  });
});

describe('useWebGPUCapabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return capabilities and loading state', async () => {
    (webgpuDetector.detectCapabilities as jest.Mock).mockResolvedValue(mockCapabilitiesSupported);

    const { result } = renderHook(() => useWebGPUCapabilities());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.capabilities).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.capabilities).toEqual(mockCapabilitiesSupported);
  });

  it('should handle errors', async () => {
    const error = new Error('Detection failed');
    (webgpuDetector.detectCapabilities as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useWebGPUCapabilities());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.capabilities).toBeNull();
  });
});