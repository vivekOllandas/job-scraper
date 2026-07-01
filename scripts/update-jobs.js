/**
 * update-jobs.js — called by GitHub Actions every 6 hours.
 * Hits the Render scraper TWICE (regular roles + internships),
 * merges results into public/jobs.json, committed back to the repo.
 *
 * Required GitHub secret:  SCRAPER_URL
 * Optional GitHub vars:    JOB_QUERY, INDEED_LOCATION, NAUKRI_LOCATION
 */

const fs = require('fs');
const path = require('path');
const { scoreJobs } = require('./score-jobs');

const SCRAPER_URL = process.env.SCRAPER_URL;
const BASE_QUERY = process.env.QUERY || process.env.JOB_QUERY || 'data analyst power bi sql excel tableau';
const INDEED_LOCATION = process.env.INDEED_LOCATION || 'Remote';
const NAUKRI_LOCATION = process.env.NAUKRI_LOCATION || 'India';
const JOBS_FILE = path.join(__dirname, '..', 'docs', 'jobs.json');

// Two searches: regular roles, and internships in the same skill set
const SEARCHES = [
  { label: 'roles', query: BASE_QUERY },
  { label: 'internships', query: `${BASE_QUERY} intern internship` }
];

async function fetchJobs(query) {
  const url =
    `${SCRAPER_URL.replace(/\/$/, '')}/scrape/all` +
    `?q=${encodeURIComponent(query)}` +
    `&l=${encodeURIComponent(INDEED_LOCATION)}` +
    `&nl=${encodeURIComponent(NAUKRI_LOCATION)}`;

  console.log(`Fetching: ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) {
    console.error(`Scraper returned ${res.status} ${res.statusText} for query "${query}"`);
    return [];
  }
  const data = await res.json();
  console.log(
    `  → "${query}": Indeed ${data.sources?.indeed?.count ?? 0} | Naukri ${data.sources?.naukri?.count ?? 0}`
  );
  return data.jobs || [];
}

async function main() {
  if (!SCRAPER_URL) {
    console.error('❌ SCRAPER_URL is not set. Add it as a GitHub secret.');
    process.exit(1);
  }

  let allNewJobs = [];
  for (const { label, query } of SEARCHES) {
    console.log(`\n=== Searching: ${label} ("${query}") ===`);
    const jobs = await fetchJobs(query);
    allNewJobs = allNewJobs.concat(jobs);
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

  for (const job of allNewJobs) {
    if (job.link && !seen.has(job.link)) {
      merged.push(job);
      seen.add(job.link);
      addedCount++;
    }
  }

  // Keep newest 500
  merged.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  let trimmed = merged.slice(0, 500);

  // Score every job against your profile, sort best matches first
  trimmed = scoreJobs(trimmed);

  fs.writeFileSync(
    JOBS_FILE,
    JSON.stringify(
      {
        lastUpdated: new Date().toISOString(),
        query: BASE_QUERY,
        count: trimmed.length,
        jobs: trimmed
      },
      null,
      2
    )
  );

  console.log(`\n✅ Added ${addedCount} new jobs. Total stored: ${trimmed.length}.`);
}

main().catch((err) => {
  console.error('update-jobs.js failed:', err);
  process.exit(1);
});