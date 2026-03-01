function setStatus(message, color) {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.style.color = color;
}

// Weights
const WEIGHTS = {
  errorRate: 0.4,
  tabSwitchRate: 0.3,
  mouseJitter: 0.2
};

function normalize(value, baseline) {
  if (!baseline || baseline === 0) return 0;
  return (value - baseline) / baseline;
}

function computeStressScore(metrics, baseline, tabSwitchCount) {
  const durationMin = Math.max(metrics.durationMin || 1, 0.5);

  const typingSpeed = metrics.keystrokes / durationMin;
  const errorRatio =
    metrics.backspaces / Math.max(metrics.keystrokes, 1);
  const jitterRate =
    metrics.mouseJitter / durationMin;
  const tabRate =
    tabSwitchCount / durationMin;

  const dError = normalize(errorRatio, baseline.errorRate);
  const dSwitch = normalize(tabRate, baseline.tabSwitchRate);
  const dJitter = normalize(jitterRate, baseline.mouseJitter);

  const weighted =
    dError * WEIGHTS.errorRate +
    dSwitch * WEIGHTS.tabSwitchRate +
    dJitter * WEIGHTS.mouseJitter -
    normalize(typingSpeed, baseline.typingSpeed || 1) * 0.3;

  const probability = 1 / (1 + Math.exp(-3 * weighted));
  return Math.round(probability * 100);
}

function getRiskLevel(score) {
  if (score < 40) return "LOW";
  if (score < 70) return "ELEVATED";
  return "DANGER";
}

function computeBaseline(history) {
  if (!history || history.length < 3) {
    return {
      errorRate: 0.1,
      tabSwitchRate: 2,
      mouseJitter: 100
    };
  }

  let totalError = 0;
  let totalSwitch = 0;
  let totalJitter = 0;

  history.forEach((s) => {
    const durationMin = Math.max((s.duration || 60000) / 60000, 0.5);

    const typingSpeed = (s.keystrokes || 0) / durationMin;
    const errorRatio =
      (s.backspaces || 0) / Math.max(s.keystrokes || 1, 1);
    const tabRate =
      (s.tabSwitchCount || 0) / durationMin;
    const jitterRate =
      (s.mouseJitter || 0) / durationMin;

    totalError += errorRatio;
    totalSwitch += tabRate;
    totalJitter += jitterRate;
  });

  return {
    errorRate: totalError / history.length,
    tabSwitchRate: totalSwitch / history.length,
    mouseJitter: totalJitter / history.length
  };
}

// STATUS
chrome.storage.local.get("trackingState", (data) => {
  if (data.trackingState === true) setStatus("Tracking active", "green");
  else if (data.trackingState === false) setStatus("Tracking stopped", "red");
  else setStatus("Ready", "black");
});

// LIVE STRESS UI
function updateStressUI() {
  chrome.storage.local.get(
  ["liveMetrics", "tabSwitchCount", "history", "sessionStart"],
  (data) => {
    const metrics = data.liveMetrics;
    const riskBox = document.getElementById("riskBox");

    if (!metrics || !data.sessionStart) return;

    const durationMin =
      (Date.now() - data.sessionStart) / 60000;

    const baseline = computeBaseline(data.history || []);

    const score = computeStressScore(
      {
        ...metrics,
        durationMin
      },
      baseline,
      data.tabSwitchCount || 0
    );

      const level = getRiskLevel(score);

      if (riskBox) {
        riskBox.innerHTML = `
          <div class="risk-card risk-${level.toLowerCase()}">
            Stress: ${score}/100<br>
            Level: ${level}
          </div>
        `;
      }
    }
  );
}
// START
document.getElementById("capture").addEventListener("click", () => {
  chrome.storage.local.set({
  trackingState: true,
  sessionStart: Date.now()
}, () => {
    setStatus("Tracking active", "green");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.reload(tabs[0].id);
    });
  });
});

document.getElementById("stop").addEventListener("click", () => {
  chrome.storage.local.get(
    ["liveMetrics", "tabSwitchCount", "history"],
    (data) => {
      const history = data.history || [];
      const live = data.liveMetrics;

      if (live && live.keystrokes > 0) {
        const endedAt = Date.now();
const startedAt = data.sessionStart || endedAt - 60000;

history.push({
  ...live,
  tabSwitchCount: data.tabSwitchCount || 0,
  startedAt,
  endedAt,
  duration: endedAt - startedAt
});
      }

      chrome.storage.local.set(
        {
          history,
          trackingState: false,
          sessionStart: null,
          liveMetrics: {
            keystrokes: 0,
            backspaces: 0,
            mouseMoves: 0,
            mouseJitter: 0
            
          },
          tabSwitchCount: 0
        },
        () => {
          setStatus("Tracking stopped & session saved", "red");
        }
      );
    }
  );
});

// RESET
document.getElementById("reset").addEventListener("click", () => {
  chrome.storage.local.get(
    ["liveMetrics", "tabSwitchCount", "history"],
    (data) => {
      const history = data.history || [];

      history.push({
        ...data.liveMetrics,
        tabSwitchCount: data.tabSwitchCount || 0,
        endedAt: Date.now()
      });

      chrome.storage.local.set({
        history,
        sessionStart: null,
        liveMetrics: {
          keystrokes: 0,
          backspaces: 0,
          mouseMoves: 0,
          mouseJitter: 0
        },
        tabSwitchCount: 0
      });

      setStatus("Session saved & reset", "blue");
    }
  );
});

// EXPORT
document.getElementById("export").addEventListener("click", () => {
  chrome.storage.local.get(["history", "tabSwitchCount"], (data) => {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "neuroflow-report.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatus("Report downloaded", "blue");
  });
});

// LIVE REFRESH
updateStressUI();
setInterval(updateStressUI, 5000);

// DASHBOARD
const dash = document.getElementById("extDashboard");
if (dash) {
  dash.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("extDashboard/dashboard.html")
    });
  });
}