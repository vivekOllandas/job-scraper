const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeIndeed(query = 'software engineer', location = 'Remote') {
  const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`;
  const jobs = [];

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 20000
    });

    const $ = cheerio.load(data);

    $('div.job_seen_beacon, td.resultContent').each((_, el) => {
      const title = $(el).find('h2.jobTitle span').text().trim();
      const company = $(el).find('[data-testid="company-name"]').text().trim();
      const loc = $(el).find('[data-testid="text-location"]').text().trim();
      const summary = $(el).find('div.job-snippet').text().trim().replace(/\s+/g, ' ');
      const href = $(el).find('h2.jobTitle a').attr('href');

      if (title) {
        jobs.push({
          title,
          company: company || 'Unknown',
          location: loc || location,
          summary,
          link: href ? `https://www.indeed.com${href}` : url,
          postedAt: new Date().toISOString(),
          source: 'indeed'
        });
      }
    });
  } catch (err) {
    console.error('[Indeed] Error:', err.message);
  }

  return jobs;
}

module.exports = { scrapeIndeed };
