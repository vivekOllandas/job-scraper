/**
 * score-jobs.js
 * Scores each job 1-10 based on match to your profile.
 * Edit YOUR_SKILLS / YOUR_TARGET_ROLES / YOUR_EXPERIENCE_YEARS below
 * to update scoring criteria at any time - no other code needs to change.
 */

const YOUR_SKILLS = ['sql', 'power bi', 'powerbi', 'excel', 'tableau', 'python'];
const YOUR_TARGET_ROLES = ['data analyst', 'mis analyst', 'bi analyst', 'business analyst', 'reporting analyst'];
const YOUR_EXPERIENCE_YEARS = 1;

const SENIOR_KEYWORDS = ['senior', 'sr.', 'sr ', 'lead ', 'principal', 'staff ', 'head of', 'director', 'manager', 'architect'];
const ENTRY_KEYWORDS = ['entry', 'junior', 'jr.', 'jr ', 'associate', 'fresher', 'intern', 'internship', 'trainee', 'graduate', '0-1', '0-2', '1-2', '1-3'];
const HIGH_EXP_PATTERN = /\b([5-9]|1[0-9])\s?\+?\s?years?/i;

function scoreJob(job) {
  const text = `${job.title} ${job.summary}`.toLowerCase();
  let score = 0;

  // Title/role match (up to 4 points)
  const roleMatch = YOUR_TARGET_ROLES.some(role => job.title.toLowerCase().includes(role));
  if (roleMatch) score += 4;
  else if (YOUR_TARGET_ROLES.some(role => text.includes(role))) score += 2;

  // Skill overlap (up to 4 points, capped)
  const skillMatches = YOUR_SKILLS.filter(skill => text.includes(skill));
  score += Math.min(skillMatches.length, 4);

  // Seniority fit (up to +2 / -3)
  const looksSenior = SENIOR_KEYWORDS.some(k => text.includes(k)) || HIGH_EXP_PATTERN.test(text);
  const looksEntry = ENTRY_KEYWORDS.some(k => text.includes(k));

  if (looksSenior) score -= 3;
  else if (looksEntry) score += 2;
  else score += 1; // neutral listings get a small bump rather than penalty

  // Clamp 1-10
  score = Math.max(1, Math.min(10, score));

  return {
    ...job,
    matchScore: score,
    matchedSkills: skillMatches
  };
}

function scoreJobs(jobs) {
  return jobs.map(scoreJob).sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = { scoreJob, scoreJobs };