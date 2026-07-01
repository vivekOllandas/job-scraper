const express = require('express');
const path = require('path');
const { scrapeIndeed } = require('./scrapers/indeed');
const { scrapeNaukri } = require('./scrapers/naukri');

const app = express();
const PORT = process.env.PORT || 4000;

const DEFAULT_QUERY = process.env.JOB_QUERY || 'software engineer';
const DEFAULT_INDEED_LOCATION = process.env.INDEED_LOCATION || 'Remote';
const DEFAULT_NAUKRI_LOCATION = process.env.NAUKRI_LOCATION || '';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/scrape/indeed', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const l = req.query.l || DEFAULT_INDEED_LOCATION;
  try {
    const jobs = await scrapeIndeed(q, l);
    res.json({ query: q, location: l, count: jobs.length, jobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/scrape/naukri', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const l = req.query.l || DEFAULT_NAUKRI_LOCATION;
  try {
    const { jobs, debug } = await scrapeNaukri(q, l);
    res.json({ query: q, location: l, count: jobs.length, jobs, debug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/scrape/all', async (req, res) => {
  const q = req.query.q || DEFAULT_QUERY;
  const indeedLoc = req.query.l || DEFAULT_INDEED_LOCATION;
  const naukriLoc = req.query.nl || DEFAULT_NAUKRI_LOCATION;

  const [indeedResult, naukriResult] = await Promise.allSettled([
    scrapeIndeed(q, indeedLoc),
    scrapeNaukri(q, naukriLoc)
  ]);

  const indeedJobs = indeedResult.status === 'fulfilled' ? indeedResult.value : [];
  const { jobs: naukriJobs = [], debug: naukriDebug = {} } =
    naukriResult.status === 'fulfilled' ? naukriResult.value : {};

  const jobs = [...indeedJobs, ...naukriJobs];

  res.json({
    query: q,
    count: jobs.length,
    sources: {
      indeed: { count: indeedJobs.length, status: indeedResult.status },
      naukri: { count: naukriJobs.length, status: naukriResult.status, debug: naukriDebug }
    },
    jobs
  });
});

// Debug: see raw API key status + test call
app.get('/debug/apikey', (req, res) => {
  const key = process.env.RAPIDAPI_KEY;
  res.json({
    keySet: !!key,
    keyLength: key ? key.length : 0,
    keyPreview: key ? key.slice(0, 6) + '...' : null
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`RAPIDAPI_KEY set: ${!!process.env.RAPIDAPI_KEY}`);
});
