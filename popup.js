// popup.js (replace your file with this)
document.addEventListener("DOMContentLoaded", async () => {
  const openBtn = document.getElementById("open");
  const saveBtn = document.getElementById("saveKey");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const toggleKeyBtn = document.getElementById("toggleKey");
  const statusEl = document.getElementById("status");

  // Load state from storage
  const data = await chrome.storage.local.get(["sidebarVisible", "apiKey"]);

  // Set settings button label
  openBtn.textContent = data.sidebarVisible ? "Hide Settings" : "Show Settings";

  // Load saved API key
  if (data.apiKey) {
    apiKeyInput.value = data.apiKey;
    statusEl.textContent = "API Key loaded.";
    setTimeout(() => (statusEl.textContent = ""), 2000);
  }

  // Save API key
  saveBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      statusEl.textContent = "⚠️ Please enter a valid API key.";
      return;
    }
    await chrome.storage.local.set({ apiKey: key });
    statusEl.textContent = "API Key saved.";
    setTimeout(() => (statusEl.textContent = ""), 2000);
  });

  // Toggle API key visibility
  toggleKeyBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyBtn.textContent = "hide";
    } else {
      apiKeyInput.type = "password";
      toggleKeyBtn.textContent = "show";
    }
  });

  // Sidebar toggle
  openBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const nextState = openBtn.textContent === "Show Settings"; // true = want to show

    chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar", visible: nextState });

    await chrome.storage.local.set({ sidebarVisible: nextState });
  openBtn.textContent = nextState ? "Hide Settings" : "Show Settings";
  });

});
