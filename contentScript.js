console.log("NeuroFlow content script injected");

if (!window.__NEUROFLOW_INIT) {
  window.__NEUROFLOW_INIT = true;

  let enabled = false;

  chrome.storage.local.get("trackingState", (data) => {
    enabled = data.trackingState === true;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.trackingState) {
      enabled = changes.trackingState.newValue === true;
    }
  });

  function updateStorage(updateFn) {
    chrome.storage.local.get("liveMetrics", (data) => {
      const current = data.liveMetrics || {
        keystrokes: 0,
        backspaces: 0,
        mouseMoves: 0,
        mouseJitter: 0
      };

      const updated = updateFn(current);
      chrome.storage.local.set({ liveMetrics: updated });
    });
  }

  window.addEventListener("keydown", (e) => {
    if (!enabled) return;

    updateStorage((m) => {
      m.keystrokes++;
      if (e.key === "Backspace") m.backspaces++;
      return m;
    });
  }, true);

  let lastPos = null;

  window.addEventListener("mousemove", (e) => {
    if (!enabled) return;

    updateStorage((m) => {
      m.mouseMoves++;

      if (lastPos) {
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 60) m.mouseJitter++;
      }

      lastPos = { x: e.clientX, y: e.clientY };
      return m;
    });
  });
}