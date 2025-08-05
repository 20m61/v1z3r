import type { NextApiRequest, NextApiResponse } from 'next';

interface RUMMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // VJ-specific metrics
  audioLatency?: number;
  videoFrameRate?: number;
  renderingLatency?: number;
  effectProcessingTime?: number;
  webgpuPerformance?: number;
  
  // User context
  url: string;
  userAgent: string;
  timestamp: string;
  sessionId?: string;
  userId?: string;
  
  // Device info
  deviceMemory?: number;
  hardwareConcurrency?: number;
  effectiveType?: string; // Network connection type
  
  // Custom metrics
  customMetrics?: Record<string, number>;
}

interface RUMResponse {
  success: boolean;
  message?: string;
  metricsId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RUMResponse>
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const rumMetrics: RUMMetrics = {
      // Core Web Vitals
      fcp: req.body.fcp,
      lcp: req.body.lcp,
      fid: req.body.fid,
      cls: req.body.cls,
      ttfb: req.body.ttfb,
      
      // VJ-specific metrics
      audioLatency: req.body.audioLatency,
      videoFrameRate: req.body.videoFrameRate,
      renderingLatency: req.body.renderingLatency,
      effectProcessingTime: req.body.effectProcessingTime,
      webgpuPerformance: req.body.webgpuPerformance,
      
      // Context
      url: req.body.url || req.headers.referer || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: req.body.sessionId,
      userId: req.body.userId,
      
      // Device info
      deviceMemory: req.body.deviceMemory,
      hardwareConcurrency: req.body.hardwareConcurrency,
      effectiveType: req.body.effectiveType,
      
      // Custom metrics
      customMetrics: req.body.customMetrics || {}
    };

    // Generate unique metrics ID
    const metricsId = `rum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[RUM METRICS]', {
        metricsId,
        ...rumMetrics
      });
    }

    // Analyze performance and flag issues
    const performanceIssues = analyzePerformance(rumMetrics);
    if (performanceIssues.length > 0) {
      console.warn('🔍 Performance Issues Detected:', performanceIssues);
    }

    // In production, you would send this to:
    // - AWS X-Ray
    // - Google Analytics
    // - Custom monitoring service
    
    // await sendToXRay(rumMetrics, metricsId);
    // await sendToAnalytics(rumMetrics, metricsId);

    res.status(200).json({
      success: true,
      message: 'RUM metrics received',
      metricsId
    });

  } catch (error) {
    console.error('Failed to process RUM metrics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process RUM metrics'
    });
  }
}

// Performance analysis function
function analyzePerformance(metrics: RUMMetrics): string[] {
  const issues: string[] = [];
  
  // Core Web Vitals thresholds
  if (metrics.fcp && metrics.fcp > 2500) {
    issues.push(`Slow First Contentful Paint: ${metrics.fcp}ms`);
  }
  
  if (metrics.lcp && metrics.lcp > 4000) {
    issues.push(`Slow Largest Contentful Paint: ${metrics.lcp}ms`);
  }
  
  if (metrics.fid && metrics.fid > 300) {
    issues.push(`High First Input Delay: ${metrics.fid}ms`);
  }
  
  if (metrics.cls && metrics.cls > 0.25) {
    issues.push(`High Cumulative Layout Shift: ${metrics.cls}`);
  }
  
  // VJ-specific thresholds
  if (metrics.audioLatency && metrics.audioLatency > 50) {
    issues.push(`High Audio Latency: ${metrics.audioLatency}ms`);
  }
  
  if (metrics.videoFrameRate && metrics.videoFrameRate < 30) {
    issues.push(`Low Frame Rate: ${metrics.videoFrameRate}fps`);
  }
  
  if (metrics.renderingLatency && metrics.renderingLatency > 16.67) {
    issues.push(`High Rendering Latency: ${metrics.renderingLatency}ms`);
  }
  
  if (metrics.effectProcessingTime && metrics.effectProcessingTime > 10) {
    issues.push(`Slow Effect Processing: ${metrics.effectProcessingTime}ms`);
  }
  
  return issues;
}

// Helper function to send to AWS X-Ray (implementation placeholder)
async function sendToXRay(metrics: RUMMetrics, metricsId: string) {
  // TODO: Implement AWS X-Ray integration
  // const AWSXRay = require('aws-xray-sdk-core');
  // 
  // const segment = new AWSXRay.Segment('v1z3r-rum-metrics');
  // segment.addMetadata('metrics', { metricsId, ...metrics });
  // segment.addAnnotation('url', metrics.url);
  // segment.addAnnotation('userId', metrics.userId);
  // 
  // AWSXRay.captureAsyncFunc('rum-processing', async (subsegment) => {
  //   // Process metrics
  //   subsegment.close();
  // });
}

// Helper function to send to Google Analytics (implementation placeholder)
async function sendToAnalytics(metrics: RUMMetrics, metricsId: string) {
  // TODO: Implement Google Analytics 4 integration
  // const { gtag } = require('gtag');
  // 
  // gtag('event', 'rum_metrics', {
  //   event_category: 'performance',
  //   event_label: metricsId,
  //   value: Math.round(metrics.lcp || 0),
  //   custom_parameters: {
  //     fcp: metrics.fcp,
  //     fid: metrics.fid,
  //     cls: metrics.cls,
  //     audio_latency: metrics.audioLatency,
  //     frame_rate: metrics.videoFrameRate
  //   }
  // });
}