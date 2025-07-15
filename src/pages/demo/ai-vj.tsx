/**
 * AI VJ Demo Page
 * Showcases all advanced AI and WebGPU features
 */

import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with WebGPU/Canvas
const AIVJDemo = dynamic(() => import('@/components/AIVJDemo'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading AI VJ System...</p>
      </div>
    </div>
  ),
});

export default function AIVJDemoPage() {
  return (
    <>
      <Head>
        <title>v1z3r - AI VJ Demo</title>
        <meta name="description" content="Professional AI-powered VJ system with WebGPU acceleration" />
      </Head>

      <div className="h-screen bg-black overflow-hidden">
        <AIVJDemo className="w-full h-full" />
      </div>
    </>
  );
}