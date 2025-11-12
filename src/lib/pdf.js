const { URL } = require('url');
const puppeteer = require('puppeteer');
const knex = require('../db/knex');
const config = require('../config');
const { toFeetInches } = require('./stats');

// Import Chromium for serverless environments (Netlify Functions, AWS Lambda)
let chromium = null;
if (config.isServerless) {
  try {
    chromium = require('@sparticuz/chromium');
  } catch (error) {
    console.warn('[renderCompCard] @sparticuz/chromium not available, falling back to default Puppeteer');
  }
}

async function loadProfile(slug) {
  try {
    const profile = await knex('profiles').where({ slug }).first();
    if (!profile) return null;
    const images = await knex('images').where({ profile_id: profile.id }).orderBy('sort');
    return { profile, images };
  } catch (error) {
    // Log database errors for debugging
    console.error('[loadProfile] Database error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      slug: slug
    });
    // Re-throw error with context for route handlers to catch
    throw error;
  }
}

async function renderCompCard(slug, theme = null) {
  if (config.nodeEnv === 'test') {
    return Buffer.from(`PDF placeholder for ${slug}`);
  }
  
  let browser = null;
  
  try {
    // Build URL with theme parameter
    let target;
    try {
      console.log('[renderCompCard] Building PDF view URL:', {
        pdfBaseUrl: config.pdfBaseUrl,
        slug: slug,
        theme: theme,
        nodeEnv: config.nodeEnv,
        isServerless: config.isServerless
      });
      
      const url = new URL(`/pdf/view/${slug}`, config.pdfBaseUrl);
      if (theme) {
        url.searchParams.set('theme', theme);
      }
      target = url.toString();
      
      console.log('[renderCompCard] Target URL:', target);
    } catch (urlError) {
      console.error('[renderCompCard] Error constructing URL:', {
        message: urlError.message,
        pdfBaseUrl: config.pdfBaseUrl,
        slug: slug,
        theme: theme
      });
      throw new Error(`Invalid PDF base URL: ${config.pdfBaseUrl}. Please check your configuration.`);
    }
    
    // Puppeteer configuration for serverless environments
    // Additional args for better compatibility with AWS Lambda/Netlify Functions
    const puppeteerArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Important for serverless
      '--disable-gpu'
    ];
    
    // For serverless environments, use @sparticuz/chromium
    let launchOptions = {
      headless: 'new',
      args: puppeteerArgs
    };
    
    if (config.isServerless && chromium) {
      // Use @sparticuz/chromium for Netlify Functions
      console.log('[renderCompCard] Using @sparticuz/chromium for serverless environment');
      
      // executablePath() may be async in newer versions, handle both cases
      let executablePath;
      try {
        executablePath = chromium.executablePath();
        // If it's a Promise, await it
        if (executablePath && typeof executablePath.then === 'function') {
          executablePath = await executablePath;
        }
      } catch (error) {
        console.error('[renderCompCard] Error getting Chromium executable path:', error);
        throw new Error('Failed to get Chromium executable path for serverless environment.');
      }
      
      launchOptions.executablePath = executablePath;
      // Add serverless-specific args (chromium.args is already optimized for serverless)
      launchOptions.args = [
        ...chromium.args,
        ...puppeteerArgs,
        '--hide-scrollbars',
        '--disable-web-security'
      ];
    } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      // Allow custom executable path override
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    
    try {
      console.log('[renderCompCard] Launching Puppeteer:', {
        isServerless: config.isServerless,
        hasChromium: !!chromium,
        executablePath: launchOptions.executablePath ? 'set' : 'default',
        executablePathType: typeof launchOptions.executablePath
      });
      
      browser = await puppeteer.launch(launchOptions);
    } catch (launchError) {
      console.error('[renderCompCard] Error launching Puppeteer browser:', {
        message: launchError.message,
        code: launchError.code,
        name: launchError.name
      });
      throw new Error('Failed to launch PDF browser. Please check your server configuration.');
    }

    try {
      const page = await browser.newPage();
      
      // Navigate to PDF view URL with timeout
      try {
        console.log('[renderCompCard] Navigating to PDF view URL:', target);
        await page.goto(target, { 
          waitUntil: 'networkidle0',
          timeout: 30000 // 30 second timeout
        });
        console.log('[renderCompCard] Successfully navigated to PDF view URL');
      } catch (navigationError) {
        console.error('[renderCompCard] Error navigating to PDF view URL:', {
          message: navigationError.message,
          target: target,
          code: navigationError.code,
          name: navigationError.name,
          stack: navigationError.stack
        });
        throw new Error(`Failed to load PDF view: ${navigationError.message}. Please check that the PDF view URL is accessible.`);
      }
      
      await page.emulateMediaType('print');
      
      // Generate PDF with timeout and optimization settings
      let buffer;
      try {
        buffer = await page.pdf({
          width: '5.5in',
          height: '8.5in',
          margin: { top: '0.2in', bottom: '0.2in', left: '0.2in', right: '0.2in' },
          printBackground: true,
          timeout: 30000, // 30 second timeout
          // Optimize for smaller file size
          preferCSSPageSize: false,
          // Disable tagged PDF to reduce size (helps with file size)
          tagged: false,
          // Note: Puppeteer automatically compresses images in PDFs
        });
        
        console.log('[renderCompCard] PDF generated, size:', buffer.length, 'bytes (', (buffer.length / 1024 / 1024).toFixed(2), 'MB)');
        
        // Check if PDF is too large (Netlify Functions have ~6MB response limit)
        const maxSize = 5 * 1024 * 1024; // 5MB safety limit
        if (buffer.length > maxSize) {
          console.warn('[renderCompCard] PDF is large (', (buffer.length / 1024 / 1024).toFixed(2), 'MB). Consider optimizing images.');
        }
      } catch (pdfError) {
        console.error('[renderCompCard] Error generating PDF:', {
          message: pdfError.message,
          code: pdfError.code,
          name: pdfError.name
        });
        throw new Error(`Failed to generate PDF: ${pdfError.message}`);
      }
      
      return buffer;
    } catch (pageError) {
      // Log page-related errors
      console.error('[renderCompCard] Error with PDF page:', {
        message: pageError.message,
        code: pageError.code,
        name: pageError.name,
        target: target
      });
      throw pageError;
    } finally {
      // Ensure browser is closed even on error
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[renderCompCard] Error closing browser:', closeError.message);
        }
      }
    }
  } catch (error) {
    // Log all errors for debugging
    console.error('[renderCompCard] Error generating PDF:', {
      message: error.message,
      code: error.code,
      name: error.name,
      slug: slug,
      theme: theme,
      pdfBaseUrl: config.pdfBaseUrl
    });
    // Re-throw error with context for route handlers to catch
    throw error;
  }
}

module.exports = {
  loadProfile,
  renderCompCard,
  toFeetInches
};
