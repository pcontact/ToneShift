document.addEventListener("DOMContentLoaded", async () => {
  const openBtn = document.getElementById("open");
  const saveBtn = document.getElementById("saveKey");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const toggleKeyBtn = document.getElementById("toggleKey");
  const statusEl = document.getElementById("status");

  // Load state from storage
  const data = await chrome.storage.local.get(["sidebarVisible", "apiKey"]);

  // Set sidebar button label
  openBtn.textContent = data.sidebarVisible ? "Hide Sidebar" : "Show Sidebar";

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
      toggleKeyBtn.textContent = "hide"; // change icon when visible
    } else {
      apiKeyInput.type = "password";
      toggleKeyBtn.textContent = "show"; // back to hidden
    }
  });

  // Sidebar toggle
  openBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sidebar = document.getElementById("toneshift-sidebar");

        if (!sidebar) {
          // Inject content.js if not already injected
          const script = document.createElement("script");
          script.src = chrome.runtime.getURL("content.js");
          script.type = "module";
          document.body.appendChild(script);
          chrome.storage.local.set({ sidebarVisible: true });
        } else {
          const hideBtn = document.getElementById("ts-hide-sidebar");
          if (sidebar.style.display === "none") {
            sidebar.style.display = "block";
            if (hideBtn) hideBtn.textContent = "Hide Sidebar";
            chrome.storage.local.set({ sidebarVisible: true });
          } else {
            sidebar.style.display = "none";
            if (hideBtn) hideBtn.textContent = "Show Sidebar";
            chrome.storage.local.set({ sidebarVisible: false });
          }
        }
      }
    });

    // Update popup button text immediately
    openBtn.textContent =
      openBtn.textContent === "Show Sidebar" ? "Hide Sidebar" : "Show Sidebar";
  });
});
