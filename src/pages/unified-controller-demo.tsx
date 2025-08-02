/**
 * Unified Controller Demo Page
 * Demonstration of the professional VJ controller interface
 */

import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { UnifiedController } from '@/components/UnifiedController';
import styles from '@/styles/pages/UnifiedControllerDemo.module.css';

const UnifiedControllerDemo: NextPage = () => {
  return (
    <>
      <Head>
        <title>v1z3r - Unified Controller Demo</title>
        <meta name="description" content="Professional VJ controller interface demonstration" />
      </Head>

      <div className={styles.container}>
        <UnifiedController 
          showPerformanceMetrics={true}
          midiEnabled={true}
          onStateChange={(state) => {
            console.log('Controller state:', state);
          }}
        />
      </div>
    </>
  );
};

export default UnifiedControllerDemo;