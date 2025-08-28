Stock Prediction Game (GitHub Pages)

Overview
This is a static web app that lets you guess whether a stock’s next trading day closes higher or lower. It fetches real daily market data from Alpha Vantage (no demo data) and renders a live-updating chart.

Features
- Enter any stock ticker (e.g., MSFT, AAPL, COF)
- Validates via real Alpha Vantage daily data
- Picks a random non-holiday weekday start date within the last 7–100 days
- Shows the prior 7 days of data plus the start day on a line chart
- You guess Up/Down for the next trading day; score updates on reveal
- Continues revealing subsequent days until you stop or data runs out

Tech
- Plain HTML/CSS/JS
- Charting: Chart.js via CDN
- Data: Alpha Vantage TIME_SERIES_DAILY (compact)

Local Development
You can open index.html directly in a browser. For best results (and to avoid any local CORS quirks), use a static server:

```bash
cd /path/to/repo
python3 -m http.server 8080
# then open http://localhost:8080/
```

Deployment to GitHub Pages
1) Create a new GitHub repository and push these files to the repository root (not a subfolder).
2) In GitHub, go to Settings → Pages.
3) Under “Build and deployment”, set Source to “Deploy from a branch”.
4) Select your default branch (e.g., main) and the root folder (/), then Save.
5) Wait for GitHub Pages to publish, then open the provided URL.

Configuration
The Alpha Vantage API key is embedded in app.js as provided by the requester. If you fork this project, you may replace it with your own key in app.js.

Notes
- Alpha Vantage has rate limits (5 requests per minute, 500 per day). This app makes a single call per ticker load.
- Market holidays and weekends are automatically respected by using actual trading days from the time series.