document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.history) {
        loadDashboard();
      }
    });
  }
});

function loadDashboard() {
  if (chrome?.storage?.local) {
    chrome.storage.local.get(["history"], (data) => {
      processHistory(data.history || []);
    });
  } else {
    processHistory(generateDemoData());
  }
}

// Demo data
function generateDemoData() {
  const sessions = [];
  for (let i = 0; i < 25; i++) {
    sessions.push({
      keystrokes: 200 + Math.random() * 100,
      backspaces: Math.random() * 20,
      mouseJitter: 50 + Math.random() * 100,
      tabSwitchCount: Math.random() * 5,
      duration: (10 + Math.random() * 30) * 60000,
      endedAt: Date.now() - (25 - i) * 24 * 60 * 60 * 1000
    });
  }
  return sessions;
}

function processHistory(historyRaw) {
  const history = (historyRaw || [])
    .slice()
    .sort((a, b) => a.endedAt - b.endedAt);

  if (!history.length) {
    document.getElementById("totalSessions").textContent = 0;
    return;
  }

  const enriched = history.map((s) => {
    const durationMin = Math.max((s.duration || 60000) / 60000, 0.5);

    const typingSpeed = (s.keystrokes || 0) / durationMin / 5;
    const errorRatio = (s.backspaces || 0) / Math.max(s.keystrokes || 1, 1);
    const jitterRate = (s.mouseJitter || 0) / durationMin;
    const tabRate = (s.tabSwitchCount || 0) / durationMin;

    return {
      ...s,
      durationMin,
      typingSpeed,
      errorRatio,
      jitterRate,
      tabRate,
    };
  });

  // Baseline (first 20 sessions)
  const base = enriched.slice(0, 20);

  const avg = (arr, key) =>
    arr.reduce((sum, s) => sum + (s[key] || 0), 0) /
    Math.max(arr.length, 1);

  const baseline = {
    typing: avg(base, "typingSpeed"),
    error: avg(base, "errorRatio"),
    jitter: avg(base, "jitterRate"),
    tabs: avg(base, "tabRate"),
  };

  // Burnout calculation
  enriched.forEach((s, i) => {
    if (i < 20) {
      s.burnoutScore = 50;
      return;
    }

    const d_error = clamp(deviation(s.errorRatio, baseline.error), -1.5, 1.5);
    const d_tabs = clamp(deviation(s.tabRate, baseline.tabs), -1.5, 1.5);
    const d_jitter = clamp(deviation(s.jitterRate, baseline.jitter), -1.5, 1.5);
    const d_typing = clamp(deviation(s.typingSpeed, baseline.typing), -1.5, 1.5);

    const S =
      0.35 * d_error +
      0.25 * d_tabs +
      0.25 * d_jitter -
      0.25 * d_typing;

    const logistic = 1 / (1 + Math.exp(-1.2 * S));
    let score = Math.round(50 + (logistic - 0.5) * 100);

    s.burnoutScore = clamp(score, 0, 100);
  });

  const latest = enriched[enriched.length - 1];
  const avgBurnoutScore = avg(enriched, "burnoutScore");
  const avgLevel = burnoutLevel(avgBurnoutScore);

  // Top summary = AVERAGE burnout
  document.getElementById("burnoutScore").textContent =
    Math.round(avgBurnoutScore);

  document.getElementById("avgBurnoutLevel").textContent = avgLevel;
  document.getElementById("burnoutLevelBadge").textContent = avgLevel;
  document.getElementById("totalSessions").textContent = enriched.length;

  // Latest breakdown
  document.getElementById("typingValue").textContent =
    (latest?.typingSpeed ?? 0).toFixed(1);

  document.getElementById("errorValue").textContent =
    (latest?.errorRatio ?? 0).toFixed(2);

  document.getElementById("tabValue").textContent =
    (latest?.tabRate ?? 0).toFixed(2);

  document.getElementById("jitterValue").textContent =
    (latest?.jitterRate ?? 0).toFixed(1);

  document.getElementById("latestBurnoutScore").textContent =
    latest?.burnoutScore ?? 0;

  renderBurnoutDonut(Math.round(avgBurnoutScore));
  renderHistoryBarCharts(enriched);
}

// History charts
function renderHistoryBarCharts(sessions) {
  const lastSessions = sessions.slice(-8);
  const sessionNumbers = lastSessions.map(
    (_, i) => sessions.length - lastSessions.length + i + 1
  );

  renderBarChart(
    "typingHistoryChart",
    lastSessions.map(s => s.typingSpeed),
    sessionNumbers
  );

  renderBarChart(
    "errorHistoryChart",
    lastSessions.map(s => s.errorRatio),
    sessionNumbers
  );

  renderBarChart(
    "tabHistoryChart",
    lastSessions.map(s => s.tabRate),
    sessionNumbers
  );

  renderBarChart(
    "jitterHistoryChart",
    lastSessions.map(s => s.jitterRate),
    sessionNumbers
  );
}

function renderBarChart(containerId, data, sessionNumbers) {
  const container = document.getElementById(containerId);
  const width = 160;
  const height = 80;
  const padding = 20;

  const maxY = Math.max(...data, 1);
  const barWidth = (width - 2 * padding) / data.length;

  let bars = "";

  data.forEach((value, i) => {
    const barHeight = (value / maxY) * (height - 2 * padding);
    const x = padding + i * barWidth;

    bars += `
      <rect 
        x="${x}" 
        y="${height - padding - barHeight}" 
        width="${barWidth - 3}" 
        height="${barHeight}"
        fill="#6366f1"
        rx="3"
        opacity="0.85"
      />
    `;
  });

  container.innerHTML = `
    <svg width="${width}" height="${height}">
      <text x="${padding - 5}" y="${padding}" 
            font-size="9" fill="#94a3b8" 
            text-anchor="end">
        ${maxY.toFixed(1)}
      </text>

      ${bars}

      <g font-size="8" fill="#94a3b8">
        ${sessionNumbers.map((num, i) => {
          const x = padding + i * barWidth + barWidth / 2;
          return `<text x="${x}" y="${height - 5}" text-anchor="middle">${num}</text>`;
        }).join("")}
      </g>
    </svg>
  `;
}

function renderBurnoutDonut(score) {
  const container = document.getElementById("burnoutDonut");
  const radius = 42;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const arc = (score / 100) * circumference;

  container.innerHTML = `
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle 
        cx="50" cy="50" r="${radius}" 
        fill="none" stroke="rgba(229, 231, 235, 0.3)" 
        stroke-width="${stroke}"
      />
      <circle 
        cx="50" cy="50" r="${radius}" 
        fill="none" stroke="#6366f1"
        stroke-width="${stroke}"
        stroke-dasharray="${arc} ${circumference}"
        transform="rotate(-90 50 50)"
      />
    </svg>
  `;
}

function deviation(x, baseline) {
  if (!baseline || baseline === 0) return 0;
  return (x - baseline) / baseline;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function burnoutLevel(score) {
  if (score <= 40) return "Low";
  if (score <= 70) return "Moderate";
  return "High";
}