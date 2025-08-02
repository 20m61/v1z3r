/**
 * Mock for WebGPU Detection
 */

export class WebGPUDetector {
  static async detect() {
    return Promise.resolve({
      supported: true,
      adapter: {},
      device: {},
    });
  }

  async initialize() {
    return Promise.resolve();
  }

  isSupported() {
    return true;
  }
}

export default WebGPUDetector;