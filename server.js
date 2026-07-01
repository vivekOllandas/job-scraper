const express = require('express');
const path = require('path');
const { scrapeIndeed } = require('./scrapers/indeed');
const { scrapeNaukri } = require('./scrapers/naukri');

const app = express();
const PORT = process.env.PORT || 4000;

// Config from env vars (set these on Render dashboard)
const DEFAULT_QUERY = process.env.JOB_QUERY || 'software engineer';
const DEFAULT_INDEED_LOCATION = process.env.INDEED_LOCATION || 'Remote';
const DEFAULT_NAUKRI_LOCATION = process.env.NAUKRI_LOCATION || '';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── Health check (also used by Render & uptime monitors) ──────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Indeed ─────────────────────────────────────────────────────────────
app.get('/scrape/indeed', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const l = req.query.l || DEFAULT_INDEED_LOCATION;
  try {
    console.log(`[Indeed] Scraping: "${q}" in "${l}"`);
    const jobs = await scrapeIndeed(q, l);
    console.log(`[Indeed] Found ${jobs.length} jobs`);
    res.json({ query: q, location: l, count: jobs.length, jobs });
  } catch (err) {
    console.error('[Indeed] Error:', err.message);
    res.status(500).json({ error: 'Failed to scrape Indeed', details: err.message });
  }
});

// ── Naukri ─────────────────────────────────────────────────────────────
app.get('/scrape/naukri', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const l = req.query.l || DEFAULT_NAUKRI_LOCATION;
  try {
    console.log(`[Naukri] Scraping: "${q}" in "${l}"`);
    const { jobs, debug } = await scrapeNaukri(q, l);
    console.log(`[Naukri] Found ${jobs.length} jobs | debug:`, debug);
    res.json({ query: q, location: l, count: jobs.length, jobs, debug });
  } catch (err) {
    console.error('[Naukri] Error:', err.message);
    res.status(500).json({ error: 'Failed to scrape Naukri', details: err.message });
  }
});

// ── Both sources combined ──────────────────────────────────────────────
app.get('/scrape/all', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const indeedLoc = req.query.l || DEFAULT_INDEED_LOCATION;
  const naukriLoc = req.query.nl || DEFAULT_NAUKRI_LOCATION;

  console.log(`[All] Scraping both sources for: "${q}"`);

  const [indeedResult, naukriResult] = await Promise.allSettled([
    scrapeIndeed(q, indeedLoc),
    scrapeNaukri(q, naukriLoc)
  ]);

  const indeedJobs =
    indeedResult.status === 'fulfilled' ? indeedResult.value : [];
  const { jobs: naukriJobs = [], debug: naukriDebug = {} } =
    naukriResult.status === 'fulfilled' ? naukriResult.value : {};

  const jobs = [...indeedJobs, ...naukriJobs];

  console.log(
    `[All] Indeed: ${indeedJobs.length} | Naukri: ${naukriJobs.length} | Total: ${jobs.length}`
  );

  res.json({
    query: q,
    count: jobs.length,
    sources: {
      indeed: {
        status: indeedResult.status,
        count: indeedJobs.length,
        error: indeedResult.status === 'rejected' ? indeedResult.reason?.message : null
      },
      naukri: {
        status: naukriResult.status,
        count: naukriJobs.length,
        debug: naukriDebug,
        error: naukriResult.status === 'rejected' ? naukriResult.reason?.message : null
      }
    },
    jobs
  });
});

// ── Naukri debug endpoint ──────────────────────────────────────────────
// Useful when Naukri returns 0 jobs — shows page title, card count, URL tried
app.get('/debug/naukri', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const l = req.query.l || DEFAULT_NAUKRI_LOCATION;
  try {
    const { jobs, debug } = await scrapeNaukri(q, l);
    res.json({ query: q, location: l, jobCount: jobs.length, debug, sample: jobs.slice(0, 2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Job scraper running on port ${PORT}`);
  console.log(`Defaults — query: "${DEFAULT_QUERY}", Indeed loc: "${DEFAULT_INDEED_LOCATION}", Naukri loc: "${DEFAULT_NAUKRI_LOCATION}"`);
});

// Raw debug - see exactly what Naukri returns
app.get('/debug/naukri-raw', async (req, res) => {
  const https = require('https');
  const q = req.query.q || 'software engineer';
  const l = req.query.l || '';

  const params = new URLSearchParams({
    noOfResults: '20',
    urlType: 'search_by_keyword',
    searchType: 'adv',
    keyword: q,
    location: l,
    pageNo: '1',
    k: q,
    l: l,
    seoKey: q.toLowerCase().replace(/\s+/g, '-') + '-jobs',
    src: 'jobsearchDesk',
    latLong: ''
  });

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

  const request = https.request(options, (response) => {
    let body = '';
    response.on('data', chunk => body += chunk);
    response.on('end', () => {
      res.json({ status: response.statusCode, headers: response.headers, body: body.slice(0, 2000) });
    });
  });
  request.on('error', e => res.status(500).json({ error: e.message }));
  request.end();
});
