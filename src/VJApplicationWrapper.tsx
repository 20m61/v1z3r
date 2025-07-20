/**
 * VJ Application Wrapper for Static Export
 * 
 * This wrapper ensures proper hydration in Next.js static export mode
 * by isolating all browser-dependent code.
 */

import React, { useState, useEffect } from 'react'

// Props from parent
interface VJApplicationWrapperProps {
  config?: {
    canvas?: {
      width: number
      height: number
    }
    sync?: {
      enabled: boolean
      serverUrl: string
    }
    storage?: any
  }
}

// Lazy load the actual VJ Application to avoid SSR issues
const VJApplicationWrapper: React.FC<VJApplicationWrapperProps> = ({ config }) => {
  const [mounted, setMounted] = useState(false)
  const [VJComponent, setVJComponent] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    // Set mounted flag
    setMounted(true)

    // Dynamically import VJApplication only on client side
    import('./VJApplication').then((module) => {
      setVJComponent(() => module.VJApplication)
    }).catch((error) => {
      console.error('Failed to load VJ Application:', error)
    })
  }, [])

  // Show loading state during SSR and initial client render
  if (!mounted || !VJComponent) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Initializing VJ Application...</p>
        </div>
      </div>
    )
  }

  // Render the actual VJ Application
  return <VJComponent config={config} />
}

export default VJApplicationWrapper