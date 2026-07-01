# Job Scraper — Indeed + Naukri, running on Render + GitHub Actions

Scrapes job listings from **Indeed** and **Naukri**, no PC required to keep it running.

How it works:
- A small Node/Express service (`server.js`) runs on **Render** and does the actual scraping (Playwright headless browser) on demand via HTTP endpoints.
- A **GitHub Actions** workflow runs on a schedule (every 6 hours by default), calls that Render service, and commits the results into `public/jobs.json` in this repo.
- GitHub Pages (or just opening the file) serves `public/index.html` as a simple dashboard reading from `jobs.json`.

---

## 1. Push this repo to GitHub

```bash
cd job-scraper
git init
git add .
git commit -m "Initial job scraper"
```

Create a new repo on github.com (Private is fine), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/job-scraper.git
git branch -M main
git push -u origin main
```

## 2. Deploy the scraper service to Render

1. Go to [render.com](https://render.com), sign up/log in (GitHub login is easiest)
2. **New +** → **Web Service** → connect your GitHub account → select the `job-scraper` repo
3. Configure:
   - **Name**: `job-scraper`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. **Create Web Service** and wait ~3-5 min for the first build (Playwright downloads Chromium — this is the slow part)
5. Once live, you'll get a URL like `https://job-scraper-xxxx.onrender.com`

Test it directly in your browser:
```
https://job-scraper-xxxx.onrender.com/scrape/all?q=software+engineer&l=Remote&nl=Bangalore
```
You should get back JSON with a `jobs` array.

**Note:** Render's free tier sleeps after 15 min idle and takes ~30-60s to wake on the next request. Fine for a job that runs every 6 hours — just means the first request after sleep is slower, not broken.

## 3. Wire up GitHub Actions

In your GitHub repo:

1. Go to **Settings → Secrets and variables → Actions**
2. Under **Secrets**, add:
   - `SCRAPER_URL` = `https://job-scraper-xxxx.onrender.com` (your Render URL, no trailing slash)
3. Under **Variables** (optional, has defaults if you skip these):
   - `JOB_QUERY` = e.g. `data analyst` (defaults to "software engineer")
   - `INDEED_LOCATION` = e.g. `Remote`
   - `NAUKRI_LOCATION` = e.g. `Bangalore`

The workflow at `.github/workflows/scrape.yml` will now run automatically every 6 hours, and you can also trigger it manually anytime from the **Actions** tab → **Update Job Listings** → **Run workflow**.

## 4. View your results

Two options:

- **Simplest**: open `public/jobs.json` directly in your repo on GitHub to see raw results after each run.
- **Dashboard**: enable **GitHub Pages** (Settings → Pages → Deploy from branch → `main` → `/public` folder) and visit the generated URL to see the filterable dashboard (`public/index.html`).

## Changing search terms later

Just update the `JOB_QUERY`, `INDEED_LOCATION`, `NAUKRI_LOCATION` repo variables (Settings → Secrets and variables → Actions → Variables) — no code changes needed. Next scheduled run (or manual trigger) picks them up.

## Changing the schedule

Edit the cron line in `.github/workflows/scrape.yml`:
```yaml
- cron: '0 */6 * * *'   # every 6 hours
```
Common alternatives:
- `0 * * * *` → every hour
- `0 0 * * *` → once a day at midnight UTC
- `*/15 * * * *` → every 15 minutes (not recommended on Render free tier — sleep/wake overhead)

## Important caveats

- **Neither Indeed nor Naukri offer an official public scraping API.** Both actively try to detect and block automated scraping (CAPTCHAs, layout changes, IP-based rate limits). This setup can and likely will break periodically — check the **Logs** tab on Render and the **Actions** tab on GitHub if `jobs.json` stops updating.
- Selectors in `scrapers/indeed.js` and `scrapers/naukri.js` are based on current page structure and **will need updating** if either site changes their HTML — this is normal maintenance for any scraper.
- Scraping these sites may be against their Terms of Service — this is provided for personal use; use your judgment.

## Local testing (optional, before deploying)

```bash
npm install
npm start
# then in another terminal:
curl "http://localhost:4000/scrape/all?q=software+engineer&l=Remote&nl=Bangalore"
```
