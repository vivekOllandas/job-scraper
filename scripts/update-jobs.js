/**
 * update-jobs.js — called by GitHub Actions every 6 hours.
 * Hits the Render scraper, merges new results into public/jobs.json,
 * committed back to the repo so the dashboard stays fresh.
 *
 * Required GitHub secret:  SCRAPER_URL  (your Render service URL)
 * Optional GitHub vars:    JOB_QUERY, INDEED_LOCATION, NAUKRI_LOCATION
 */

const fs = require('fs');
const path = require('path');

const SCRAPER_URL = process.env.SCRAPER_URL;
const QUERY = process.env.QUERY || process.env.JOB_QUERY || 'software engineer';
const INDEED_LOCATION = process.env.INDEED_LOCATION || 'Remote';
const NAUKRI_LOCATION = process.env.NAUKRI_LOCATION || '';
const JOBS_FILE = path.join(__dirname, '..', 'public', 'jobs.json');

async function main() {
  if (!SCRAPER_URL) {
    console.error('❌ SCRAPER_URL is not set. Add it as a GitHub secret.');
    process.exit(1);
  }

  const url =
    `${SCRAPER_URL.replace(/\/$/, '')}/scrape/all` +
    `?q=${encodeURIComponent(QUERY)}` +
    `&l=${encodeURIComponent(INDEED_LOCATION)}` +
    `&nl=${encodeURIComponent(NAUKRI_LOCATION)}`;

  console.log(`Fetching: ${url}`);

  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) {
    console.error(`Scraper returned ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data = await res.json();
  const newJobs = data.jobs || [];

  // Log per-source results for easy debugging in Actions logs
  if (data.sources) {
    console.log(
      `Indeed: ${data.sources.indeed?.count ?? 0} jobs (${data.sources.indeed?.status})` +
      (data.sources.indeed?.error ? ` — Error: ${data.sources.indeed.error}` : '')
    );
    console.log(
      `Naukri: ${data.sources.naukri?.count ?? 0} jobs (${data.sources.naukri?.status})` +
      (data.sources.naukri?.error ? ` — Error: ${data.sources.naukri.error}` : '') +
      (data.sources.naukri?.debug ? ` — Debug: ${JSON.stringify(data.sources.naukri.debug)}` : '')
    );
  }

  // Load existing jobs to preserve history
  let existing = [];
  if (fs.existsSync(JOBS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8')).jobs || [];
    } catch (_) {
      console.warn('Could not parse existing jobs.json, starting fresh.');
    }
  }

  // De-dupe by link
  const seen = new Set(existing.map((j) => j.link));
  let addedCount = 0;
  const merged = [...existing];

  for (const job of newJobs) {
    if (!seen.has(job.link)) {
      merged.push(job);
      seen.add(job.link);
      addedCount++;
    }
  }

  // Keep newest 500, sort by scraped time
  merged.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  const trimmed = merged.slice(0, 500);

  fs.writeFileSync(
    JOBS_FILE,
    JSON.stringify(
      {
        lastUpdated: new Date().toISOString(),
        query: QUERY,
        count: trimmed.length,
        jobs: trimmed
      },
      null,
      2
    )
  );

  console.log(`✅ Added ${addedCount} new jobs. Total stored: ${trimmed.length}.`);
}

main().catch((err) => {
  console.error('update-jobs.js failed:', err);
  process.exit(1);
});
