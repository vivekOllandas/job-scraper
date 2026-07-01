const { chromium } = require('playwright');

/**
 * Scrapes Naukri job listings with anti-detection measures.
 * @param {string} query - job title / keywords
 * @param {string} location - e.g. "Bangalore", "India", "" for all
 * @returns {Promise<{jobs: Array, debug: object}>}
 */
async function scrapeNaukri(query = 'software engineer', location = '') {
  const debug = { url: '', cardCount: 0, pageTitle: '', error: null };

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1366,768'
    ]
  });

  const jobs = [];

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      }
    });

    // Remove navigator.webdriver fingerprint
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // Build URL - Naukri uses slug-based URLs
    const slug = query.trim().toLowerCase().replace(/\s+/g, '-');
    const locationSlug = location ? location.trim().toLowerCase().replace(/\s+/g, '-') : '';
    const url = locationSlug
      ? `https://www.naukri.com/${slug}-jobs-in-${locationSlug}`
      : `https://www.naukri.com/${slug}-jobs`;

    debug.url = url;

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

    // Dismiss any popups/cookie banners
    try {
      await page.click('button#cookiePref, button.cross, div.crossIcon', { timeout: 3000 });
    } catch (_) {}

    // Wait for job cards to actually appear in DOM
    await page.waitForSelector(
      'article.jobTuple, div.cust-job-tuple, div[class*="srp-jobtuple"], div[class*="jobTuple"]',
      { timeout: 15000 }
    ).catch(() => null);

    // Extra wait for lazy-loaded content
    await page.waitForTimeout(2000);

    debug.pageTitle = await page.title();

    // Try multiple known selectors across Naukri's different page layouts
    const CARD_SELECTORS = [
      'article.jobTuple',
      'div.cust-job-tuple',
      'div[class*="srp-jobtuple"]',
      'div[class*="jobTupleHeader"]',
      'li[class*="jobTuple"]'
    ];

    let cards = [];
    for (const sel of CARD_SELECTORS) {
      cards = await page.$$(sel);
      if (cards.length > 0) break;
    }

    debug.cardCount = cards.length;

    for (const card of cards) {
      try {
        // Title — try multiple selectors
        const title = await card.evaluate((el) => {
          const a =
            el.querySelector('a.title') ||
            el.querySelector('a[class*="title"]') ||
            el.querySelector('.jobTitle a') ||
            el.querySelector('h2 a') ||
            el.querySelector('a.job-title');
          return a ? a.textContent.trim() : null;
        });

        if (!title) continue;

        const link = await card.evaluate((el) => {
          const a =
            el.querySelector('a.title') ||
            el.querySelector('a[class*="title"]') ||
            el.querySelector('.jobTitle a') ||
            el.querySelector('h2 a') ||
            el.querySelector('a.job-title');
          return a ? a.href : null;
        });

        const company = await card.evaluate((el) => {
          const el2 =
            el.querySelector('a.subTitle') ||
            el.querySelector('a[class*="comp-name"]') ||
            el.querySelector('span[class*="comp-name"]') ||
            el.querySelector('.companyInfo a') ||
            el.querySelector('a.companyName');
          return el2 ? el2.textContent.trim() : 'Unknown';
        });

        const jobLocation = await card.evaluate((el) => {
          const el2 =
            el.querySelector('span.locWdth') ||
            el.querySelector('li.location span') ||
            el.querySelector('span[class*="loc"]') ||
            el.querySelector('.location');
          return el2 ? el2.textContent.trim() : null;
        });

        const experience = await card.evaluate((el) => {
          const el2 =
            el.querySelector('span.expwdth') ||
            el.querySelector('li.experience span') ||
            el.querySelector('span[class*="exp"]');
          return el2 ? el2.textContent.trim() : null;
        });

        const salary = await card.evaluate((el) => {
          const el2 =
            el.querySelector('span.salary') ||
            el.querySelector('li.salary span') ||
            el.querySelector('span[class*="sal"]');
          return el2 ? el2.textContent.trim() : null;
        });

        const summary = await card.evaluate((el) => {
          const el2 =
            el.querySelector('div.job-description') ||
            el.querySelector('span.job-desc') ||
            el.querySelector('ul.tags-gt') ||
            el.querySelector('[class*="description"]');
          return el2 ? el2.textContent.trim().replace(/\s+/g, ' ').slice(0, 300) : '';
        });

        const postedAt = await card.evaluate((el) => {
          const el2 =
            el.querySelector('span.job-post-day') ||
            el.querySelector('span[class*="date"]') ||
            el.querySelector('.postDate');
          return el2 ? el2.textContent.trim() : null;
        });

        jobs.push({
          title,
          company,
          location: jobLocation || location || 'India',
          experience: experience || null,
          salary: salary || null,
          summary,
          postedAt: postedAt || new Date().toISOString(),
          link: link || url,
          source: 'naukri'
        });
      } catch (_) {
        continue;
      }
    }
  } catch (err) {
    debug.error = err.message;
    console.error('Naukri scrape error:', err.message);
  } finally {
    await browser.close();
  }

  return { jobs, debug };
}

module.exports = { scrapeNaukri };
