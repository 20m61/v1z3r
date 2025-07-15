import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { features, categories } from '@/data/features'
import { useState } from 'react'

export default function Features() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredFeatures = selectedCategory === 'all' 
    ? features 
    : features.filter(f => f.category === selectedCategory)

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            Feature <span className="gradient-text">Index</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12 max-w-3xl">
            Explore the comprehensive feature set that makes v1z3r the most powerful VJ application for live performances.
          </p>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-12">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedCategory === 'all'
                  ? 'bg-vj-primary text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All Features
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  selectedCategory === category
                    ? 'bg-vj-primary text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeatures.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="card group cursor-pointer hover:border-vj-primary/50"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-3xl">{feature.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1 group-hover:text-vj-primary transition-colors">
                      {feature.title}
                    </h3>
                    <span className="text-sm text-vj-secondary">{feature.category}</span>
                  </div>
                </div>
                
                <p className="text-gray-400 mb-4">{feature.description}</p>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-300">Key Features:</h4>
                  <ul className="space-y-1">
                    {feature.details.slice(0, 3).map((detail, idx) => (
                      <li key={idx} className="text-sm text-gray-500 flex items-start gap-2">
                        <span className="text-vj-accent mt-1">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                    {feature.details.length > 3 && (
                      <li className="text-sm text-gray-600 italic">
                        +{feature.details.length - 3} more features...
                      </li>
                    )}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Feature Highlights */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold mb-8 text-center">
              Why Choose <span className="gradient-text">v1z3r</span>?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-vj-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Professional Grade</h3>
                <p className="text-gray-400">
                  Built for professional VJs with industry-standard features and reliability
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-vj-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🚀</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Cutting Edge</h3>
                <p className="text-gray-400">
                  WebGPU acceleration and AI-powered features for next-gen performances
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-vj-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🌐</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Open & Modular</h3>
                <p className="text-gray-400">
                  Open-source with modular architecture for endless customization
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  )
}