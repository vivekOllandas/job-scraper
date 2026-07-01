const { chromium } = require('playwright');

/**
 * Scrapes Indeed job listings.
 * @param {string} query - job title / keywords, e.g. "software engineer"
 * @param {string} location - e.g. "Remote", "New York"
 * @returns {Promise<Array<{title, company, location, summary, link, postedAt, source}>>}
 */
async function scrapeIndeed(query = 'software engineer', location = 'Remote') {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const jobs = [];

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
    });
    const page = await context.newPage();

    const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(
      query
    )}&l=${encodeURIComponent(location)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Indeed sometimes shows a captcha/interstitial - give it a moment
    await page.waitForTimeout(2000);

    // Job cards live inside elements with data-jk (job key) attribute
    const cards = await page.$$('div.job_seen_beacon, td.resultContent');

    for (const card of cards) {
      try {
        const title = await card.$eval(
          'h2.jobTitle span, h2.jobTitle a span',
          (el) => el.textContent.trim()
        ).catch(() => null);

        const company = await card
          .$eval('span[data-testid="company-name"]', (el) => el.textContent.trim())
          .catch(() => null);

        const jobLocation = await card
          .$eval('div[data-testid="text-location"]', (el) => el.textContent.trim())
          .catch(() => null);

        const summary = await card
          .$eval('div.job-snippet, div[data-testid="jobsnippet_footer"]', (el) =>
            el.textContent.trim().replace(/\s+/g, ' ')
          )
          .catch(() => null);

        const relativeLink = await card
          .$eval('h2.jobTitle a', (el) => el.getAttribute('href'))
          .catch(() => null);

        if (title) {
          jobs.push({
            title,
            company: company || 'Unknown',
            location: jobLocation || location,
            summary: summary || '',
            link: relativeLink ? `https://www.indeed.com${relativeLink}` : url,
            postedAt: new Date().toISOString(),
            source: 'indeed'
          });
        }
      } catch (innerErr) {
        // Skip malformed card, keep going
        continue;
      }
    }
  } finally {
    await browser.close();
  }

  return jobs;
}

module.exports = { scrapeIndeed };
