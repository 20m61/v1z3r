/**
 * v1z3r Main Application Page
 * 
 * This is the main entry point for the v1z3r VJ application.
 * It integrates all modules (Visual Renderer, VJ Controller, Sync Core, Preset Storage)
 * into a unified experience.
 */

import Head from 'next/head'
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

// 動的インポートでVJApplicationWrapperを読み込み
const VJApplicationWrapper = dynamic(() => import('../VJApplicationWrapper'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-white">Loading VJ Application...</div>
})

export default function Home() {
  const [isStarted, setIsStarted] = useState(false)

  // VJ Application configuration
  const vjConfig = {
    canvas: {
      width: 1920,
      height: 1080
    },
    sync: {
      enabled: false, // Disabled by default - can be enabled in production
      serverUrl: 'ws://localhost:8080'
    },
    storage: undefined // Disabled by default - can be configured with AWS credentials
  }

  const handleStart = () => {
    setIsStarted(true)
  }

  return (
    <>
      <Head>
        <title>v1z3r - Professional VJ Application</title>
        <meta name="description" content="Professional VJ application with modular architecture for real-time visual performance" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="w-full h-screen bg-black text-white overflow-hidden">
        {!isStarted ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center h-full bg-gradient-to-br from-gray-900 to-black"
          >
              <div className="text-center max-w-2xl px-8">
                <motion.h1
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-6"
                >
                  v1z3r
                </motion.h1>
                
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl text-gray-300 mb-8"
                >
                  Professional VJ Application
                </motion.p>
                
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-4 mb-12"
                >
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-gray-300">Modular Architecture</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span className="text-gray-300">Real-time Visual Effects</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span className="text-gray-300">Parameter Control Interface</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-pink-400 rounded-full"></div>
                    <span className="text-gray-300">Preset Management</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                    <span className="text-gray-300">AI Style Transfer</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                    <span className="text-gray-300">3D Scene Manipulation</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-gray-300">MIDI 2.0 Control</span>
                  </div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="text-gray-300">NDI Streaming</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
                  className="space-y-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(99, 102, 241, 0.5)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStart}
                    className="px-12 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full text-xl font-semibold transition-all duration-300 shadow-lg"
                  >
                    Launch VJ Application
                  </motion.button>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.0 }}
                    className="flex justify-center space-x-4"
                  >
                    <motion.a
                      href="/advanced-features"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm font-medium transition-colors"
                    >
                      Advanced Features
                    </motion.a>
                    <motion.a
                      href="/mobile-demo"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm font-medium transition-colors"
                    >
                      Mobile Demo
                    </motion.a>
                    <motion.a
                      href="/webgpu-demo"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm font-medium transition-colors"
                    >
                      WebGPU Demo
                    </motion.a>
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="mt-8 text-sm text-gray-500"
                >
                  <p>Built with Next.js • WebGPU • AI • MIDI • NDI</p>
                  <p className="mt-2">Phase 7: Advanced Features • Production Ready</p>
                </motion.div>
              </div>
            </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full h-full"
          >
            <VJApplicationWrapper config={vjConfig} />
          </motion.div>
        )}
      </main>
    </>
  )
}
