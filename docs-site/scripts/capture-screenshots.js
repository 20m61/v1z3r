const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, '../public/screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Screenshots to capture
const screenshots = [
  {
    name: 'home',
    url: 'http://localhost:3000',
    description: 'v1z3r homepage',
    viewport: { width: 1920, height: 1080 },
  },
  {
    name: 'vj-interface',
    url: 'http://localhost:3000',
    description: 'Main VJ interface',
    viewport: { width: 1920, height: 1080 },
    steps: async (page) => {
      // Click the launch button
      await page.waitForSelector('button:has-text("Launch VJ Application")', { timeout: 5000 });
      await page.click('button:has-text("Launch VJ Application")');
      await page.waitForTimeout(2000);
    },
  },
  {
    name: 'ai-demo',
    url: 'http://localhost:3000/demo/ai-vj',
    description: 'AI VJ Demo',
    viewport: { width: 1920, height: 1080 },
    waitFor: 3000,
  },
  {
    name: 'mobile-home',
    url: 'http://localhost:3000',
    description: 'Mobile homepage',
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
  },
  {
    name: 'tablet-interface',
    url: 'http://localhost:3000',
    description: 'Tablet VJ interface',
    viewport: { width: 1024, height: 768 }, // iPad
    steps: async (page) => {
      await page.waitForSelector('button:has-text("Launch VJ Application")', { timeout: 5000 });
      await page.click('button:has-text("Launch VJ Application")');
      await page.waitForTimeout(2000);
    },
  },
];

async function captureScreenshots() {
  console.log('🚀 Starting screenshot capture...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const screenshot of screenshots) {
    try {
      console.log(`📸 Capturing ${screenshot.name}...`);
      
      const page = await browser.newPage();
      await page.setViewport(screenshot.viewport);
      
      // Go to URL
      await page.goto(screenshot.url, { waitUntil: 'networkidle2' });
      
      // Execute any custom steps
      if (screenshot.steps) {
        await screenshot.steps(page);
      }
      
      // Wait if specified
      if (screenshot.waitFor) {
        await page.waitForTimeout(screenshot.waitFor);
      }
      
      // Take screenshot
      const filePath = path.join(screenshotsDir, `${screenshot.name}.png`);
      await page.screenshot({
        path: filePath,
        fullPage: false,
      });
      
      console.log(`✅ Saved ${screenshot.name}.png`);
      
      // Also save a WebP version for better performance
      const webpPath = path.join(screenshotsDir, `${screenshot.name}.webp`);
      await page.screenshot({
        path: webpPath,
        fullPage: false,
        type: 'webp',
        quality: 85,
      });
      
      console.log(`✅ Saved ${screenshot.name}.webp`);
      
      await page.close();
    } catch (error) {
      console.error(`❌ Error capturing ${screenshot.name}:`, error);
    }
  }

  await browser.close();
  console.log('🎉 Screenshot capture complete!');
}

// Generate screenshot metadata
async function generateMetadata() {
  const metadata = screenshots.map(s => ({
    name: s.name,
    description: s.description,
    viewport: s.viewport,
    files: {
      png: `/screenshots/${s.name}.png`,
      webp: `/screenshots/${s.name}.webp`,
    },
  }));

  const metadataPath = path.join(screenshotsDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log('📝 Generated screenshot metadata');
}

// Check if v1z3r is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('❌ v1z3r server is not running on http://localhost:3000');
    console.log('💡 Please start the server with: yarn dev');
    process.exit(1);
  }

  await captureScreenshots();
  await generateMetadata();
}

main().catch(console.error);