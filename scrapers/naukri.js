const https = require('https');

// Uses a working RapidAPI for India jobs since Naukri blocks direct access
async function scrapeNaukri(query = 'software engineer', location = '') {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return { jobs: [], debug: { error: 'No API key' } };

  // JSearch with India country filter gives Naukri + other India job boards
  return new Promise((resolve) => {
    const q = location ? `${query} ${location} India` : `${query} India`;
    const path = `/search?query=${encodeURIComponent(q)}&page=1&num_pages=1&country=in&date_posted=month`;

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
        console.log(`[Naukri/JSearch] status=${res.statusCode} body=${body.slice(0,100)}`);
        try {
          const data = JSON.parse(body);
          const jobs = (data.data || []).map(j => ({
            title: j.job_title,
            company: j.employer_name || 'Unknown',
            location: j.job_city ? `${j.job_city}, ${j.job_country}` : (location || 'India'),
            summary: j.job_description ? j.job_description.slice(0, 300) : '',
            link: j.job_apply_link || j.job_google_link || '',
            postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
            source: 'naukri'
          }));
          resolve({ jobs, debug: { count: jobs.length, status: res.statusCode } });
        } catch (e) {
          resolve({ jobs: [], debug: { error: e.message, body: body.slice(0,200) } });
        }
      });
    });
    req.on('error', e => resolve({ jobs: [], debug: { error: e.message } }));
    req.end();
  });
}

module.exports = { scrapeNaukri };
