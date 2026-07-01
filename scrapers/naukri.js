const https = require('https');

/**
 * Uses Naukri's internal search API (same one their website uses).
 * No key required but may need occasional selector updates.
 */
async function scrapeNaukri(query = 'software engineer', location = '') {
  const jobs = [];
  const debug = { url: '', cardCount: 0, error: null };

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      noOfResults: '20',
      urlType: 'search_by_keyword',
      searchType: 'adv',
      keyword: query,
      location: location || '',
      pageNo: '1',
      k: query,
      l: location || '',
      seoKey: query.toLowerCase().replace(/\s+/g, '-') + '-jobs',
      src: 'jobsearchDesk',
      latLong: ''
    });

    const url = `https://www.naukri.com/jobapi/v3/search?${params.toString()}`;
    debug.url = url;

    const options = {
      method: 'GET',
      hostname: 'www.naukri.com',
      path: `/jobapi/v3/search?${params.toString()}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.naukri.com/',
        'appid': '109',
        'systemid': '109',
        'x-requested-with': 'XMLHttpRequest'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const listings = data.jobDetails || [];
          debug.cardCount = listings.length;

          for (const j of listings) {
            jobs.push({
              title: j.title || 'Unknown',
              company: j.companyName || 'Unknown',
              location: (j.placeholders?.find(p => p.type === 'location')?.label) || location || 'India',
              experience: j.placeholders?.find(p => p.type === 'experience')?.label || null,
              salary: j.placeholders?.find(p => p.type === 'salary')?.label || null,
              summary: j.jobDescription ? j.jobDescription.replace(/<[^>]*>/g, '').slice(0, 300) : '',
              link: j.jdURL || `https://www.naukri.com${j.jobId}`,
              postedAt: j.createdDate ? new Date(j.createdDate).toISOString() : new Date().toISOString(),
              source: 'naukri'
            });
          }
          resolve({ jobs, debug });
        } catch (e) {
          debug.error = e.message;
          console.error('[Naukri] Parse error:', e.message, body.slice(0, 200));
          resolve({ jobs: [], debug });
        }
      });
    });

    req.on('error', (e) => {
      debug.error = e.message;
      console.error('[Naukri] Request error:', e.message);
      resolve({ jobs: [], debug });
    });

    req.end();
  });
}

module.exports = { scrapeNaukri };
