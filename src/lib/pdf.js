const { URL } = require('url');
const puppeteer = require('puppeteer');
const knex = require('../db/knex');
const config = require('../config');
const { toFeetInches } = require('./stats');

async function loadProfile(slug) {
  const profile = await knex('profiles').where({ slug }).first();
  if (!profile) return null;
  const images = await knex('images').where({ profile_id: profile.id }).orderBy('sort');
  return { profile, images };
}

async function renderCompCard(slug, theme = null) {
  if (config.nodeEnv === 'test') {
    return Buffer.from(`PDF placeholder for ${slug}`);
  }
  const url = new URL(`/pdf/view/${slug}`, config.pdfBaseUrl);
  if (theme) {
    url.searchParams.set('theme', theme);
  }
  const target = url.toString();
  
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
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: puppeteerArgs,
    // In serverless, we may need to set executable path if Chromium is in a specific location
    // Puppeteer should handle this automatically, but we can override if needed
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    })
  });

  try {
    const page = await browser.newPage();
    await page.goto(target, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    const buffer = await page.pdf({
      width: '5.5in',
      height: '8.5in',
      margin: { top: '0.2in', bottom: '0.2in', left: '0.2in', right: '0.2in' },
      printBackground: true
    });
    return buffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  loadProfile,
  renderCompCard,
  toFeetInches
};
