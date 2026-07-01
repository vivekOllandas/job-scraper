const https = require('https');

function parseJobs(data, location, source) {
  // data.data can be array or object with jobs inside
  let list = [];
  if (Array.isArray(data.data)) {
    list = data.data;
  } else if (data.data && Array.isArray(data.data.jobs)) {
    list = data.data.jobs;
  } else if (data.data && typeof data.data === 'object') {
    // flatten any array values
    list = Object.values(data.data).find(v => Array.isArray(v)) || [];
  }

  return list.map(j => ({
    title: j.job_title || j.title || 'Unknown',
    company: j.employer_name || j.company || 'Unknown',
    location: j.job_city ? `${j.job_city}, ${j.job_country}` : location,
    summary: (j.job_description || j.description || '').slice(0, 300),
    link: j.job_apply_link || j.job_google_link || j.url || '',
    postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
    source
  }));
}

function jsearchRequest(apiKey, query, location, country = 'in') {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      query: `${query} ${location}`,
      page: '1',
      num_pages: '1',
      country,
      date_posted: 'week'
    });

    const options = {
      method: 'GET',
      hostname: 'jsearch.p.rapidapi.com',
      path: `/search-v2?${params.toString()}`,
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
        console.log(`[JSearch] status=${res.statusCode} preview=${body.slice(0,150)}`);
        try {
          resolve({ data: JSON.parse(body), raw: body });
        } catch (e) {
          resolve({ data: {}, raw: body });
        }
      });
    });
    req.on('error', e => resolve({ data: {}, raw: e.message }));
    req.end();
  });
}

async function scrapeIndeed(query = 'software engineer', location = 'Remote') {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];
  const { data } = await jsearchRequest(apiKey, query, location, 'us');
  return parseJobs(data, location, 'indeed');
}

module.exports = { scrapeIndeed, jsearchRequest, parseJobs };
