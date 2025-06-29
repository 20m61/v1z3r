/**
 * VJ Application Test Page
 * 
 * A dedicated page for testing the integrated VJ application.
 * This page provides a clean environment to test all module integrations.
 */

import React from 'react'
import Head from 'next/head'
import VJApplication from '../VJApplication'

const VJAppPage: React.FC = () => {
  const config = {
    canvas: {
      width: 800,
      height: 600
    },
    sync: {
      enabled: false, // Disabled for testing since we don't have a running server
      serverUrl: 'ws://localhost:8080'
    },
    storage: undefined // Disabled for testing since we don't have AWS configured
  }

  return (
    <>
      <Head>
        <title>VJ Application Test</title>
        <meta name="description" content="Test page for VJ Application integration" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <VJApplication config={config} />
    </>
  )
}

export default VJAppPage