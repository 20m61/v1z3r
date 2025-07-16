import Layout from '@/components/Layout'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'

const features = [
  {
    title: 'AI-Powered Visuals',
    description: 'Real-time music analysis with TensorFlow.js for intelligent visual adaptation',
    icon: '🤖',
  },
  {
    title: 'WebGPU Acceleration',
    description: 'Hardware-accelerated particle systems and compute shaders for stunning effects',
    icon: '⚡',
  },
  {
    title: 'MIDI Integration',
    description: 'Professional MIDI controller support with velocity-sensitive controls',
    icon: '🎹',
  },
  {
    title: 'Real-time Collaboration',
    description: 'WebSocket-based multi-device synchronization for live performances',
    icon: '🔄',
  },
  {
    title: 'Modular Architecture',
    description: 'Six independent modules for maximum flexibility and scalability',
    icon: '📦',
  },
  {
    title: 'Cloud Storage',
    description: 'AWS-powered preset management with DynamoDB and S3 integration',
    icon: '☁️',
  },
]

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-vj-primary/20 via-transparent to-vj-accent/20"></div>
        <div className="container mx-auto px-4 py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="gradient-text">v1z3r</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8">
              Professional AI-Powered VJ Application
            </p>
            <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
              Create stunning live visuals with real-time audio analysis, WebGPU acceleration, and intelligent AI-driven effects.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/getting-started" className="btn-primary">
                Get Started
              </Link>
              <Link href="/features" className="btn-secondary">
                Explore Features
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <motion.h2 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
        >
          Powerful Features for <span className="gradient-text">Live Performance</span>
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card group hover:scale-105 transition-transform duration-300"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-vj-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Screenshot Section */}
      <section className="bg-vj-dark/30 py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              See It In <span className="gradient-text">Action</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Experience the power of v1z3r with stunning visual effects synchronized to your music.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="card overflow-hidden"
            >
              <div className="aspect-video bg-gradient-to-br from-vj-primary/20 to-vj-accent/20 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-4xl">🎬</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Main Interface</h3>
              <p className="text-gray-400">Intuitive control panel with real-time parameter adjustment</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="card overflow-hidden"
            >
              <div className="aspect-video bg-gradient-to-br from-vj-secondary/20 to-vj-primary/20 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-4xl">✨</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Visual Effects</h3>
              <p className="text-gray-400">WebGPU-powered particle systems and post-processing effects</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Quick <span className="gradient-text">Start</span>
          </h2>
          
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-vj-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-vj-primary font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Install Dependencies</h3>
                  <div className="code-block">
                    <code className="text-green-400">$ git clone https://github.com/20m61/v1z3r.git</code><br/>
                    <code className="text-green-400">$ cd v1z3r &amp;&amp; yarn install</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-vj-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-vj-secondary font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Start Development Server</h3>
                  <div className="code-block">
                    <code className="text-green-400">$ yarn dev</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-vj-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-vj-accent font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Launch VJ Application</h3>
                  <p className="text-gray-400">Open http://localhost:3000 and click &quot;Launch VJ Application&quot;</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/getting-started" className="btn-primary">
              View Full Documentation →
            </Link>
          </div>
        </motion.div>
      </section>
    </Layout>
  )
}