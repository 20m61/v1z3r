import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Getting Started', href: '/getting-started' },
  { name: 'Features', href: '/features' },
  { name: 'Manual', href: '/manual' },
  { name: 'Shortcuts', href: '/shortcuts' },
  { name: 'API', href: '/api' },
  { name: 'Developer', href: '/developer' },
]

export default function Layout({ children }: LayoutProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-vj-dark/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-vj-primary to-vj-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">V</span>
              </div>
              <span className="text-xl font-bold gradient-text">v1z3r Docs</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`nav-link ${router.pathname === item.href ? 'active' : ''}`}
                >
                  {item.name}
                </Link>
              ))}
              <a
                href="https://github.com/your-username/v1z3r"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                GitHub
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-vj-dark border-t border-gray-800 py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 gradient-text">v1z3r</h3>
              <p className="text-gray-400">
                Professional VJ application with AI-powered visual effects and real-time audio analysis.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link href="/getting-started" className="text-gray-400 hover:text-white">Getting Started</Link></li>
                <li><Link href="/features" className="text-gray-400 hover:text-white">Features</Link></li>
                <li><Link href="/shortcuts" className="text-gray-400 hover:text-white">Shortcuts</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="https://github.com/your-username/v1z3r" className="text-gray-400 hover:text-white">GitHub</a></li>
                <li><Link href="/api" className="text-gray-400 hover:text-white">API Reference</Link></li>
                <li><Link href="/developer" className="text-gray-400 hover:text-white">Developer Guide</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2025 v1z3r. Built with Next.js and Tailwind CSS.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}