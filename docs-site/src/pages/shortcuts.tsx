import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { shortcuts, midiMappings, formatShortcut } from '@/data/shortcuts'

export default function Shortcuts() {
  // Group shortcuts by category
  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            Keyboard <span className="gradient-text">Shortcuts</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12 max-w-3xl">
            Master v1z3r with these keyboard shortcuts for faster workflow and live performance control.
          </p>

          {/* Keyboard Shortcuts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {categories.map((category) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="card"
              >
                <h2 className="text-2xl font-semibold mb-6 text-vj-primary">{category}</h2>
                <div className="space-y-3">
                  {shortcuts
                    .filter(s => s.category === category)
                    .map((shortcut, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                        <span className="text-gray-300">{shortcut.description}</span>
                        <kbd className="px-3 py-1 bg-gray-800 rounded text-sm font-mono text-vj-primary">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* MIDI Controller Mappings */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              MIDI Controller <span className="gradient-text">Mappings</span>
            </h2>
            
            <p className="text-xl text-gray-400 mb-8">
              v1z3r supports professional MIDI controllers with pre-configured mappings for optimal VJ performance.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {midiMappings.map((controller) => (
                <motion.div
                  key={controller.controller}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="card"
                >
                  <h3 className="text-xl font-semibold mb-4 gradient-text">{controller.controller}</h3>
                  <div className="space-y-3">
                    {controller.mappings.map((mapping, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-4">
                        <span className="text-vj-secondary font-medium">{mapping.control}</span>
                        <span className="text-gray-400 text-right text-sm">{mapping.function}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Tips Section */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mt-16 card bg-gradient-to-br from-vj-primary/10 to-vj-accent/10"
          >
            <h3 className="text-2xl font-semibold mb-4">Pro Tips</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-vj-primary mt-1">•</span>
                <span>Use number keys (1-9) for quick preset switching during live performances</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-vj-secondary mt-1">•</span>
                <span>Combine Shift with navigation keys for fine-tuned parameter adjustments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-vj-accent mt-1">•</span>
                <span>MIDI controllers provide tactile feedback for better live control</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-vj-primary mt-1">•</span>
                <span>Custom key bindings can be configured in Settings → Keyboard</span>
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  )
}