#!/usr/bin/env node

/**
 * Generate PWA icons script
 * Creates placeholder icons for v1z3r VJ Application
 */

const fs = require('fs');
const path = require('path');

// Simple SVG icon generator
function generateSVGIcon(size) {
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00ccff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0066cc;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.1}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">v1z3r</text>
  <circle cx="${size * 0.8}" cy="${size * 0.2}" r="${size * 0.05}" fill="white" opacity="0.8">
    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
  </circle>
</svg>
  `.trim();
}

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate icon sizes
const iconSizes = [72, 144, 192, 512];

iconSizes.forEach(size => {
  const svgContent = generateSVGIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(publicDir, filename);
  
  fs.writeFileSync(filepath, svgContent);
  console.log(`Generated: ${filename}`);
});

// Generate placeholder PNG notice
const placeholderNotice = `
# PWA Icon Placeholders

This directory contains SVG placeholder icons for the v1z3r VJ application.

For production, replace these with proper PNG icons:
- icon-72x72.png
- icon-144x144.png  
- icon-192x192.png
- icon-512x512.png

You can convert the SVG files to PNG using:
- Online tools like https://convertio.co/svg-png/
- Command line: \`inkscape icon-192x192.svg --export-png=icon-192x192.png\`
- Design tools like Figma, Sketch, or Photoshop

## Icon Requirements
- 72x72: Small device icon
- 144x144: Medium device icon  
- 192x192: Standard PWA icon
- 512x512: High-resolution icon for app stores

## Design Guidelines
- Use the v1z3r brand colors (#00ccff primary)
- Include clear, readable text/logo
- Ensure icons look good at small sizes
- Follow platform-specific design guidelines
`;

fs.writeFileSync(path.join(publicDir, 'ICONS_README.md'), placeholderNotice.trim());

console.log('\n✅ PWA icons generated successfully!');
console.log('📝 Check ICONS_README.md for production guidelines');
console.log('🎨 Replace SVG files with PNG versions for production use');