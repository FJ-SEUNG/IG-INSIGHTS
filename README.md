# IG-INSIGHTS

Instagram analytics automation for the @flyingjapan account — automated data collection, performance dashboard, and AI content planning.

## Stack

- **Backend:** Python 3.11 (requests, gspread, google-auth, feedparser)
- **Frontend:** Vanilla JS + HTML/CSS (no framework, no bundler)
- **Charts:** ApexCharts, Tabulator, SheetJS, html2pdf.js
- **AI:** Google Gemini API (gemma-3-27b-it) for content generation + report narrative
- **CI/CD:** GitHub Actions (2 daily cron workflows)
- **Hosting:** GitHub Pages (static site from `docs/`)

## Structure

```
ig_insights.py             Meta Graph API -> Google Sheets (posts, followers, daily report)
export_json.py             Google Sheets -> docs/data/*.json (static export)
scripts/content_planner.py RSS feeds (8 JP sources) -> Gemini AI -> content_plans.json
docs/                      GitHub Pages dashboard (index.html + js/app.js + css/style.css)
docs/data/                 Auto-updated JSON: posts, followers, daily_report, content_plans, meta
```

## Data Flow

```
Meta Graph API -> ig_insights.py -> Google Sheets -> export_json.py -> docs/data/*.json -> GitHub Pages
RSS Feeds (8)  -> content_planner.py -> Gemini AI -> docs/data/content_plans.json -> GitHub Pages
```

## CI Schedules

- `daily-insights.yml` — 08:17 KST: collect Instagram metrics + export JSON
- `content-planner.yml` — 09:00 KST: scrape JP news + generate content ideas via AI

## Secrets (GitHub)

`ACCESS_TOKEN`, `APP_ID`, `APP_SECRET`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `GOOGLE_CREDENTIALS_JSON`, `SPREADSHEET_ID`, `GEMINI_API_KEY`
