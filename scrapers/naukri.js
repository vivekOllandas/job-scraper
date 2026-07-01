const { jsearchRequest, parseJobs } = require('./indeed');

async function scrapeNaukri(query = 'software engineer', location = '') {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return { jobs: [], debug: { error: 'No API key' } };

  const loc = location || 'India';
  const { data, raw } = await jsearchRequest(apiKey, query, loc, 'in');
  const jobs = parseJobs(data, loc, 'naukri');

  console.log(`[Naukri] parsed ${jobs.length} jobs, raw preview: ${raw.slice(0,200)}`);
  return { jobs, debug: { count: jobs.length, rawPreview: raw.slice(0, 300) } };
}

module.exports = { scrapeNaukri };
