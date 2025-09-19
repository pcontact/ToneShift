chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ ToneShift installed");
});

// Inject sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
});

// Handle messages globally
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openPopup") {
    // Try opening popup first (only works with user gesture)
    if (chrome.action.openPopup) {
      chrome.action.openPopup().catch(() => {
        chrome.runtime.openOptionsPage(); // fallback
      });
    } else {
      chrome.runtime.openOptionsPage();
    }
  }
});
