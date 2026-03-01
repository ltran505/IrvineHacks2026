console.log("NeuroFlow background running");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    tabSwitchCount: 0
  });
});

chrome.tabs.onActivated.addListener(() => {
  chrome.storage.local.get(
    ["trackingState", "tabSwitchCount"],
    (data) => {
      if (!data.trackingState) return;

      const count = (data.tabSwitchCount || 0) + 1;
      chrome.storage.local.set({ tabSwitchCount: count });
    }
  );
});