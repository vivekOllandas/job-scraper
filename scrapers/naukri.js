const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeNaukri(query = 'software engineer', location = '') {
  const slug = query.trim().toLowerCase().replace(/\s+/g, '-');
  const locationSlug = location ? location.trim().toLowerCase().replace(/\s+/g, '-') : '';
  const url = locationSlug
    ? `https://www.naukri.com/${slug}-jobs-in-${locationSlug}`
    : `https://www.naukri.com/${slug}-jobs`;

  const jobs = [];
  const debug = { url, cardCount: 0, error: null };

  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.naukri.com/'
      },
      timeout: 20000
    });

    const $ = cheerio.load(data);

    $('article.jobTuple, div.cust-job-tuple, div[class*="srp-jobtuple"]').each((_, el) => {
      const title = $(el).find('a.title, a[class*="title"]').first().text().trim();
      const link = $(el).find('a.title, a[class*="title"]').first().attr('href');
      const company = $(el).find('a.subTitle, a[class*="comp-name"]').first().text().trim();
      const loc = $(el).find('span.locWdth, span[class*="loc"]').first().text().trim();
      const exp = $(el).find('span.expwdth, span[class*="exp"]').first().text().trim();
      const salary = $(el).find('span.salary, span[class*="sal"]').first().text().trim();
      const summary = $(el).find('div.job-description, span.job-desc').first().text().trim().replace(/\s+/g, ' ').slice(0, 300);

      if (title) {
        jobs.push({
          title,
          company: company || 'Unknown',
          location: loc || location || 'India',
          experience: exp || null,
          salary: salary || null,
          summary,
          link: link || url,
          postedAt: new Date().toISOString(),
          source: 'naukri'
        });
      }
    });

    debug.cardCount = jobs.length;
  } catch (err) {
    debug.error = err.message;
    console.error('[Naukri] Error:', err.message);
  }

  return { jobs, debug };
}

module.exports = { scrapeNaukri };
