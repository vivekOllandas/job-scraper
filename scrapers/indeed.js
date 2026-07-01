const https = require('https');

async function scrapeIndeed(query = 'software engineer', location = 'Remote') {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('[Indeed] RAPIDAPI_KEY not set');
    return [];
  }

  // Try multiple known JSearch endpoint paths
  const paths = [
    `/search?query=${encodeURIComponent(query + ' ' + location)}&page=1&num_pages=1&country=in&date_posted=week`,
    `/jobs/search?query=${encodeURIComponent(query + ' ' + location)}&page=1&num_pages=1`,
  ];

  for (const path of paths) {
    const result = await tryJSearch(apiKey, path);
    if (result.length > 0) return result;
  }
  return [];
}

function tryJSearch(apiKey, path) {
  return new Promise((resolve) => {
    const options = {
      method: 'GET',
      hostname: 'jsearch.p.rapidapi.com',
      path,
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`[JSearch] ${path.slice(0,40)} → ${res.statusCode} → ${body.slice(0,100)}`);
        try {
          const data = JSON.parse(body);
          const jobs = (data.data || []).map(j => ({
            title: j.job_title,
            company: j.employer_name || 'Unknown',
            location: j.job_city ? `${j.job_city}, ${j.job_country}` : 'Remote',
            summary: j.job_description ? j.job_description.slice(0, 300) : '',
            link: j.job_apply_link || j.job_google_link || '',
            postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
            source: 'indeed'
          }));
          resolve(jobs);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

module.exports = { scrapeIndeed };
