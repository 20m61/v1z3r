# v1z3r Documentation Site

This directory contains the source code for the v1z3r documentation site, built with Next.js and deployed to GitHub Pages.

## 🌐 Live Site

Visit the live documentation at: **[https://20m61.github.io/v1z3r/](https://20m61.github.io/v1z3r/)**

## 📁 Structure

```
docs-site/
├── src/
│   ├── pages/                 # Next.js pages
│   │   ├── index.tsx         # Homepage
│   │   ├── getting-started.tsx
│   │   ├── features.tsx      # Feature index
│   │   ├── manual.tsx        # User manual
│   │   ├── shortcuts.tsx     # Keyboard shortcuts
│   │   ├── api.tsx          # API reference
│   │   └── developer.tsx    # Developer guide
│   ├── components/
│   │   └── Layout.tsx       # Site layout
│   ├── data/
│   │   ├── features.ts      # Feature data
│   │   └── shortcuts.ts     # Shortcut data
│   └── styles/
│       └── globals.css      # Tailwind CSS
├── scripts/
│   └── capture-screenshots.js # Automated screenshots
└── public/
    └── screenshots/         # Generated screenshots
```

## 🚀 Development

### Prerequisites

- Node.js v18+
- Yarn v1.22+

### Setup

```bash
cd docs-site
yarn install
```

### Development Server

```bash
yarn dev
```

The site will be available at http://localhost:3001

### Build

```bash
yarn build
```

### Screenshot Capture

To capture screenshots automatically:

1. Start the main v1z3r application:
   ```bash
   cd ..
   yarn dev  # Run on http://localhost:3000
   ```

2. In another terminal, capture screenshots:
   ```bash
   cd docs-site
   yarn screenshot
   ```

## 🚀 Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the main branch.

### Manual Deployment

```bash
yarn build
yarn deploy  # Uses gh-pages
```

## 📝 Content

### Adding New Pages

1. Create a new `.tsx` file in `src/pages/`
2. Use the `Layout` component for consistent styling
3. Add navigation links in `src/components/Layout.tsx`

### Updating Features

Edit `src/data/features.ts` to add or modify feature descriptions.

### Updating Shortcuts

Edit `src/data/shortcuts.ts` to add or modify keyboard shortcuts and MIDI mappings.

## 🎨 Styling

The site uses:
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Custom color scheme** matching the v1z3r brand
- **Dark theme** optimized for VJ/music production environments

## 📸 Screenshots

Screenshots are automatically generated using Puppeteer and stored in `public/screenshots/`. The capture script generates both PNG and WebP versions for optimal performance.

## ⚙️ Configuration

- `next.config.js` - Next.js configuration with static export
- `tailwind.config.js` - Custom color scheme and animations
- `.github/workflows/docs.yml` - GitHub Actions deployment