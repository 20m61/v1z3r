import { NextApiRequest, NextApiResponse } from 'next';

interface PlaywrightApiResponse {
  content?: string;
  error?: string;
  metadata?: {
    url: string;
    title: string;
    contentType: string;
    timestamp: string;
    size: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlaywrightApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  // Validate required parameters
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ 
      error: 'Missing or invalid URL parameter' 
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ 
      error: 'Invalid URL format' 
    });
  }

  // Check if Playwright is available in the environment
  let playwright;
  try {
    playwright = require('playwright');
  } catch (error) {
    return res.status(500).json({ 
      error: 'Playwright not available in this environment. Please install playwright for full functionality.' 
    });
  }

  let browser;
  let page;

  try {
    // Launch browser with headless mode
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    page = await browser.newPage();

    // Set a reasonable timeout
    page.setDefaultTimeout(30000);

    // Navigate to the URL
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    if (!response) {
      throw new Error('Failed to load page');
    }

    // Get page content and metadata
    const [content, title] = await Promise.all([
      page.content(),
      page.title()
    ]);

    const contentType = response.headers()['content-type'] || 'text/html';
    const size = Buffer.byteLength(content, 'utf-8');

    return res.status(200).json({
      content,
      metadata: {
        url,
        title,
        contentType,
        timestamp: new Date().toISOString(),
        size,
      },
    });

  } catch (error: any) {
    console.error('Playwright Error:', error);

    // Handle specific errors
    if (error.message?.includes('timeout')) {
      return res.status(408).json({ 
        error: `Request timeout: Unable to load ${url} within 30 seconds` 
      });
    }

    if (error.message?.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return res.status(404).json({ 
        error: `Domain not found: ${url}` 
      });
    }

    if (error.message?.includes('net::ERR_CONNECTION_REFUSED')) {
      return res.status(503).json({ 
        error: `Connection refused: ${url}` 
      });
    }

    return res.status(500).json({ 
      error: `Failed to fetch page: ${error.message || 'Unknown error'}` 
    });

  } finally {
    // Cleanup resources
    try {
      if (page) await page.close();
      if (browser) await browser.close();
    } catch (cleanup_error) {
      console.error('Cleanup error:', cleanup_error);
    }
  }
}