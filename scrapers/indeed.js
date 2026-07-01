const https = require('https');

async function scrapeIndeed(query = 'software engineer', location = 'Remote') {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('[Indeed] RAPIDAPI_KEY not set');
    return [];
  }

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      query: `${query} ${location}`,
      page: '1',
      num_pages: '1',
      date_posted: 'week',
      remote_jobs_only: location.toLowerCase() === 'remote' ? 'true' : 'false'
    });

    const options = {
      method: 'GET',
      hostname: 'jsearch.p.rapidapi.com',
      path: `/search?${params.toString()}`,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    };

    console.log('[Indeed] Calling JSearch API...');

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('[Indeed] Status:', res.statusCode);
        console.log('[Indeed] Body preview:', body.slice(0, 300));
        try {
          const data = JSON.parse(body);
          const jobs = (data.data || []).map(j => ({
            title: j.job_title,
            company: j.employer_name || 'Unknown',
            location: j.job_city ? `${j.job_city}, ${j.job_country}` : location,
            summary: j.job_description ? j.job_description.slice(0, 300) : '',
            link: j.job_apply_link || j.job_google_link || '',
            postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
            source: 'indeed'
          }));
          console.log(`[Indeed] Got ${jobs.length} jobs`);
          resolve(jobs);
        } catch (e) {
          console.error('[Indeed] Parse error:', e.message);
          resolve([]);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[Indeed] Request error:', e.message);
      resolve([]);
    });

    req.end();
  });
}

module.exports = { scrapeIndeed };
