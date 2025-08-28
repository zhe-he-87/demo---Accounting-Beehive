(() => {
    const API_KEY = "B9GP4MFBAJ4LIU80";
    const AV_BASE = "https://www.alphavantage.co";

    /** @typedef {{ date: string, close: number }} DayBar */

    /** DOM Elements */
    const inputEl = document.getElementById("ticker");
    const loadBtn = document.getElementById("loadBtn");
    const statusEl = document.getElementById("status");
    const gameSection = document.getElementById("gameSection");
    const hudTicker = document.getElementById("hudTicker");
    const hudDate = document.getElementById("hudDate");
    const hudClose = document.getElementById("hudClose");
    const hudScore = document.getElementById("hudScore");
    const guessUpBtn = document.getElementById("guessUp");
    const guessDownBtn = document.getElementById("guessDown");
    const stopBtn = document.getElementById("stopBtn");
    const roundResultEl = document.getElementById("roundResult");
    const chartCanvas = document.getElementById("chart");

    /** Game State */
    let series = /** @type {DayBar[]} */([]);
    let currentIndex = -1; // index in series for current day (start day), series is sorted desc (latest first)
    let score = 0;
    let ticker = "";
    let chart;

    function setStatus(message, tone = "info") {
        statusEl.textContent = message || "";
        statusEl.style.color = tone === "error" ? "#f85149" : tone === "success" ? "#2ea043" : "#9da7b3";
    }

    function setRoundResult(message, isGood) {
        roundResultEl.textContent = message || "";
        roundResultEl.style.color = isGood == null ? "#9da7b3" : (isGood ? "#2ea043" : "#f85149");
    }

    function enableControls(playing) {
        guessUpBtn.disabled = !playing;
        guessDownBtn.disabled = !playing;
        stopBtn.disabled = !playing;
    }

    function resetGameUI() {
        hudTicker.textContent = "—";
        hudDate.textContent = "—";
        hudClose.textContent = "—";
        hudScore.textContent = "0";
        setRoundResult("");
        if (chart) {
            chart.destroy();
            chart = undefined;
        }
        enableControls(false);
    }

    function parseDailySeries(json) {
        const t = json["Time Series (Daily)"];
        if (!t) return [];
        const rows = Object.keys(t).map(d => ({
            date: d,
            close: Number(t[d]["4. close"]) || Number(t[d]["5. adjusted close"]) || Number(t[d]["4. close"]) || NaN
        }));
        // sort desc by date string (YYYY-MM-DD)
        rows.sort((a, b) => (a.date < b.date ? 1 : -1));
        return rows.filter(r => Number.isFinite(r.close));
    }

    async function fetchDailyBars(symbol) {
        // Use TIME_SERIES_DAILY compact (last ~100 trading days)
        const url = `${AV_BASE}/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Network error ${res.status}`);
        const json = await res.json();
        if (json["Error Message"]) throw new Error("Invalid ticker symbol. Please try another.");
        if (json["Note"]) throw new Error("API limit reached. Please wait a minute and try again.");
        const bars = parseDailySeries(json);
        if (!bars.length) throw new Error("No daily data available for this symbol.");
        return bars;
    }

    function pickRandomStartIndex(bars) {
        const today = new Date();
        const endBound = new Date(today);
        endBound.setDate(endBound.getDate() - 7);
        const startBound = new Date(today);
        startBound.setDate(startBound.getDate() - 100);

        // bars are desc (latest first)
        // Create a list of indices where the date is within [startBound, endBound]
        const eligible = [];
        for (let i = 0; i < bars.length; i++) {
            const d = new Date(bars[i].date + "T00:00:00");
            if (d >= startBound && d <= endBound) {
                eligible.push(i);
            }
        }
        // Need i to have 7 older days (i+7) and at least one newer day (i-1)
        const candidates = eligible.filter(i => i - 1 >= 0 && i + 7 < bars.length);
        if (!candidates.length) return -1;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return pick;
    }

    function formatUSD(n) {
        return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderChart(initialBarsAsc) {
        const labels = initialBarsAsc.map(b => b.date);
        const data = initialBarsAsc.map(b => b.close);
        chart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: `${ticker} Close`,
                    data,
                    borderColor: '#2f81f7',
                    backgroundColor: 'rgba(47, 129, 247, 0.15)',
                    tension: 0.25,
                    pointRadius: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#9da7b3', maxRotation: 0, autoSkip: true }, grid: { color: '#222' } },
                    y: { ticks: { color: '#9da7b3' }, grid: { color: '#222' } }
                },
                plugins: {
                    legend: { labels: { color: '#9da7b3' } },
                    tooltip: { enabled: true }
                }
            }
        });
    }

    function updateHUD() {
        hudTicker.textContent = ticker;
        hudDate.textContent = series[currentIndex]?.date || "—";
        hudClose.textContent = series[currentIndex] ? formatUSD(series[currentIndex].close) : "—";
        hudScore.textContent = String(score);
    }

    function initRound() {
        // Build initial history: 7 days before start + start day (8 points total) in ascending order
        const prior7 = [];
        for (let j = currentIndex + 7; j >= currentIndex; j--) {
            prior7.push(series[j]);
        }
        const initialAsc = prior7.map(x => x).sort((a, b) => (a.date < b.date ? -1 : 1));
        renderChart(initialAsc);
        updateHUD();
        enableControls(true);
        setRoundResult("Make a prediction: will the next day go Up or Down?", null);
    }

    async function onLoadTicker() {
        const raw = (inputEl.value || "").trim().toUpperCase();
        if (!raw) {
            setStatus("Please enter a stock ticker symbol.", "error");
            return;
        }
        // reset
        ticker = raw;
        score = 0;
        series = [];
        currentIndex = -1;
        resetGameUI();
        setStatus("Loading data…");
        setRoundResult("");

        try {
            const bars = await fetchDailyBars(ticker);
            // Validate ticker by also checking SYMBOL_SEARCH best match (optional). We'll rely on data presence.
            series = bars;
            const startIdx = pickRandomStartIndex(series);
            if (startIdx === -1) {
                throw new Error("Not enough data in the last 100 days to start a game. Try a different symbol.");
            }
            currentIndex = startIdx;
            gameSection.hidden = false;
            initRound();
            setStatus("Loaded successfully.", "success");
        } catch (err) {
            console.error(err);
            setStatus(err.message || "Failed to load ticker.", "error");
            resetGameUI();
            gameSection.hidden = true;
        }
    }

    function revealNextDay(userThinksUp) {
        if (currentIndex - 1 < 0) {
            setRoundResult("No more future days available. Game over.", false);
            enableControls(false);
            return;
        }
        const todayBar = series[currentIndex];
        const nextBar = series[currentIndex - 1]; // newer day (closer to today)
        const wentUp = nextBar.close > todayBar.close;
        const correct = (userThinksUp && wentUp) || (!userThinksUp && !wentUp);
        if (correct) score += 1;

        // Append nextBar to chart (chart labels are ascending; we just push)
        chart.data.labels.push(nextBar.date);
        chart.data.datasets[0].data.push(nextBar.close);
        chart.update();

        // Move current index forward in time (toward index 0)
        currentIndex = currentIndex - 1;
        updateHUD();
        setRoundResult(correct ? `Correct! Next close: $${formatUSD(nextBar.close)} (${wentUp ? 'Up' : 'Down'})` : `Wrong. Next close: $${formatUSD(nextBar.close)} (${wentUp ? 'Up' : 'Down'})`, correct);

        // Check if more future days remain
        if (currentIndex - 1 < 0) {
            setRoundResult(`Game over. Final score: ${score}. No more days to reveal.`, false);
            enableControls(false);
        }
    }

    function stopGame() {
        enableControls(false);
        setRoundResult(`Game ended. Final score: ${score}.`, null);
    }

    loadBtn.addEventListener('click', onLoadTicker);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onLoadTicker();
    });
    guessUpBtn.addEventListener('click', () => revealNextDay(true));
    guessDownBtn.addEventListener('click', () => revealNextDay(false));
    stopBtn.addEventListener('click', stopGame);
})();

