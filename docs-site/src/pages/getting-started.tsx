import Layout from '@/components/Layout'
import Link from 'next/link'
import { motion } from 'framer-motion'
const SyntaxHighlighter = require('react-syntax-highlighter').Prism
const vscDarkPlus = require('react-syntax-highlighter/dist/cjs/styles/prism').vscDarkPlus

export default function GettingStarted() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            Getting <span className="gradient-text">Started</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12">
            Get v1z3r up and running in minutes. Follow this guide to set up your development environment and launch your first VJ session.
          </p>

          {/* Prerequisites */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Prerequisites</h2>
            <div className="card">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-vj-primary mt-1">•</span>
                  <div>
                    <strong>Node.js</strong> v18 or later
                    <span className="text-gray-500 ml-2">(Check with <code className="text-vj-accent">node --version</code>)</span>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vj-primary mt-1">•</span>
                  <div>
                    <strong>Yarn</strong> v1.22 or later
                    <span className="text-gray-500 ml-2">(Check with <code className="text-vj-accent">yarn --version</code>)</span>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vj-primary mt-1">•</span>
                  <div>
                    <strong>Git</strong> for cloning the repository
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-vj-primary mt-1">•</span>
                  <div>
                    <strong>Modern Browser</strong> with WebGL2 support (Chrome, Firefox, Edge)
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Installation */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Installation</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">1. Clone the Repository</h3>
                <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`git clone https://github.com/your-username/v1z3r.git
cd v1z3r`}
                </SyntaxHighlighter>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">2. Install Dependencies</h3>
                <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`# Install all dependencies including workspace modules
yarn install`}
                </SyntaxHighlighter>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">3. Set Up Environment Variables</h3>
                <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your configuration
# For local development, the defaults should work fine`}
                </SyntaxHighlighter>
              </div>
            </div>
          </section>

          {/* Running the Application */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Running the Application</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Development Mode</h3>
                <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`# Start the development server
yarn dev

# The application will be available at http://localhost:3000`}
                </SyntaxHighlighter>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Production Build</h3>
                <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`# Build for production
yarn build

# Start the production server
yarn start`}
                </SyntaxHighlighter>
              </div>
            </div>
          </section>

          {/* First VJ Session */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Your First VJ Session</h2>
            
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-vj-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-vj-primary font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Launch the Application</h3>
                    <p className="text-gray-400">Navigate to http://localhost:3000 and click &quot;Launch VJ Application&quot;</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-vj-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-vj-secondary font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Enable Audio Input</h3>
                    <p className="text-gray-400">Click the microphone icon to enable audio analysis. Grant microphone permissions when prompted.</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-vj-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-vj-accent font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Select an Effect</h3>
                    <p className="text-gray-400">Use the tabs to navigate to Effects and choose your first visual effect.</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 font-bold text-sm">4</span>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Play Music & Enjoy!</h3>
                    <p className="text-gray-400">Start playing music and watch as the visuals react in real-time to your audio.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Docker Option */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Docker Development (Optional)</h2>
            
            <p className="text-gray-400 mb-4">
              For a consistent development environment across different systems, you can use Docker:
            </p>

            <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg">
{`# Quick start with Docker
docker-compose -f docker-compose.simple.yml up -d

# Or use the setup script
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh dev`}
            </SyntaxHighlighter>
          </section>

          {/* Troubleshooting */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Troubleshooting</h2>
            
            <div className="space-y-4">
              <details className="card cursor-pointer">
                <summary className="font-medium">Module resolution errors</summary>
                <div className="mt-4 text-gray-400">
                  <p>If you encounter module resolution errors, try:</p>
                  <SyntaxHighlighter language="bash" style={vscDarkPlus} className="rounded-lg mt-2">
{`# Build all workspace modules
yarn build:modules`}
                  </SyntaxHighlighter>
                </div>
              </details>

              <details className="card cursor-pointer">
                <summary className="font-medium">Audio not working</summary>
                <div className="mt-4 text-gray-400">
                  <ul className="space-y-2">
                    <li>• Ensure your browser has microphone permissions</li>
                    <li>• Check that your audio input device is selected in system settings</li>
                    <li>• Try refreshing the page and re-enabling audio</li>
                  </ul>
                </div>
              </details>

              <details className="card cursor-pointer">
                <summary className="font-medium">WebGPU not available</summary>
                <div className="mt-4 text-gray-400">
                  <p>v1z3r will automatically fall back to WebGL if WebGPU is not available. To enable WebGPU:</p>
                  <ul className="space-y-2 mt-2">
                    <li>• Use Chrome/Edge 113+ or Firefox Nightly</li>
                    <li>• Enable WebGPU flags in browser settings</li>
                    <li>• Ensure you have a compatible GPU</li>
                  </ul>
                </div>
              </details>
            </div>
          </section>

          {/* Next Steps */}
          <section>
            <h2 className="text-2xl font-semibold mb-6">Next Steps</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/features" className="card hover:border-vj-primary">
                <h3 className="text-lg font-medium mb-2">Explore Features</h3>
                <p className="text-gray-400">Discover all the powerful features v1z3r has to offer</p>
              </Link>
              
              <Link href="/manual" className="card hover:border-vj-secondary">
                <h3 className="text-lg font-medium mb-2">Read the Manual</h3>
                <p className="text-gray-400">Learn how to use v1z3r like a professional VJ</p>
              </Link>
              
              <Link href="/shortcuts" className="card hover:border-vj-accent">
                <h3 className="text-lg font-medium mb-2">Keyboard Shortcuts</h3>
                <p className="text-gray-400">Master the keyboard shortcuts for faster control</p>
              </Link>
              
              <Link href="/developer" className="card hover:border-green-500">
                <h3 className="text-lg font-medium mb-2">Developer Guide</h3>
                <p className="text-gray-400">Extend v1z3r with custom modules and effects</p>
              </Link>
            </div>
          </section>
        </motion.div>
      </div>
    </Layout>
  )
}