/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'v1z3r-primary': '#00ccff',
        'v1z3r-secondary': '#ff3366',
        'v1z3r-dark': '#121212',
        'v1z3r-darker': '#0a0a0a',
        'v1z3r-light': '#e0e0e0',
        'v1z3r-accent': '#ff9900',
        'v1z3r-error': '#ff5555',
        'v1z3r-success': '#55ff55',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 204, 255, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 204, 255, 0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': 'linear-gradient(rgba(0, 204, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 204, 255, 0.1) 1px, transparent 1px)',
      },
      backgroundSize: {
        'cyber-grid': '20px 20px',
      },
    },
  },
  plugins: [],
}
