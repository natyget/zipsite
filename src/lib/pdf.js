const { URL } = require('url');
const puppeteer = require('puppeteer');
const knex = require('../db/knex');
const config = require('../config');
const { toFeetInches } = require('./stats');

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
      const url = new URL(`/pdf/view/${slug}`, config.pdfBaseUrl);
      if (theme) {
        url.searchParams.set('theme', theme);
      }
      target = url.toString();
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
    
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: puppeteerArgs,
        // In serverless, we may need to set executable path if Chromium is in a specific location
        // Puppeteer should handle this automatically, but we can override if needed
        ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
        })
      });
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
        await page.goto(target, { 
          waitUntil: 'networkidle0',
          timeout: 30000 // 30 second timeout
        });
      } catch (navigationError) {
        console.error('[renderCompCard] Error navigating to PDF view URL:', {
          message: navigationError.message,
          target: target,
          code: navigationError.code
        });
        throw new Error(`Failed to load PDF view: ${navigationError.message}. Please check that the PDF view URL is accessible.`);
      }
      
      await page.emulateMediaType('print');
      
      // Generate PDF with timeout
      let buffer;
      try {
        buffer = await page.pdf({
          width: '5.5in',
          height: '8.5in',
          margin: { top: '0.2in', bottom: '0.2in', left: '0.2in', right: '0.2in' },
          printBackground: true,
          timeout: 30000 // 30 second timeout
        });
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
