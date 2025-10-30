document.addEventListener("DOMContentLoaded", async () => {
  const openBtn = document.getElementById("open");
  const saveBtn = document.getElementById("saveKey");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const toggleKeyBtn = document.getElementById("toggleKey");
  const statusEl = document.getElementById("status");
  const geminiCloudModelToggle = document.getElementById("ts-gemini-cloud-model-toggle")
  const generalControls = document.getElementById('ts-general-controls');

  const preserveFormattingCheckbox = document.getElementById("ts-preserve-formatting")

  // Load state from storage
  const data = await chrome.storage.local.get(["sidebarVisible", "apiKey"]);

  // Set settings button label
  openBtn.textContent = data.sidebarVisible ? "Hide Settings" : "Show Settings";
  // Help menu toggle with smooth animation
  const helpButton = document.getElementById('helpButton');
  const helpMenu = document.getElementById('helpMenu');

  helpButton.addEventListener('click', () => {
    helpMenu.classList.toggle('show');
  });

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
    const t = saveBtn.textContent
    saveBtn.textContent = "API Key saved.";
    saveBtn.disabled = true
    saveBtn.style.color = "#64bb00ff"
    setTimeout(() => {saveBtn.textContent = t; saveBtn.disabled=false; saveBtn.style.color="white"}, 2000);
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

  geminiCloudModelToggle.addEventListener('change', (e) => {
    e.stopPropagation();
    const useCloudModel = geminiCloudModelToggle.checked;
    chrome.storage.local.set({  useCloudModel }, () => {
      console.log("Set useCloudModel to", useCloudModel);
      chrome.runtime.sendMessage({ action: 'updateGeminiModelPreference', useCloudModel });
      updateGeneralControlState(geminiCloudModelToggle.checked)
    });
  });

  function updateGeneralControlState(state) {
    const enabled = state;
    if (enabled) {
      generalControls.classList.remove('inactive');
      apiKeyInput.disabled = false;
      saveBtn.disabled = false;
    } else {
      generalControls.classList.add('inactive');
      apiKeyInput.disabled = true;
      saveBtn.disabled = true;
    }
  }

    // Add a change event listener to the checkbox
  preserveFormattingCheckbox?.addEventListener('change', (event) => {
      // Get the checked state of the checkbox
      const rewriteWithFormat = event.target.checked;

      // Use chrome.storage.local.set() to save the value
      chrome.storage.local.set({ rewriteWithFormat: rewriteWithFormat }, () => {
          if (chrome.runtime.lastError) {
              console.error("Error setting withFormatting:", chrome.runtime.lastError);
          } else {
              console.log("rewriteWithFormat value is now:", rewriteWithFormat);
          }
      });
  });

  const showFloatingCheckbox = document.getElementById('ts-show-floating');
  if (showFloatingCheckbox) {
    // Load saved preference; default to true
    chrome.storage.local.get('showFloatingOnHighlight', (data) => {
      if (data.showFloatingOnHighlight === undefined || data.showFloatingOnHighlight === null) {
        showFloatingCheckbox.checked = false;
      } else {
        showFloatingCheckbox.checked = data.showFloatingOnHighlight;
      }
    });

    showFloatingCheckbox.addEventListener('change', (e) => {
      const enabled = !!e.target.checked;
      chrome.storage.local.set({ showFloatingOnHighlight: enabled }, () => {
        if (chrome.runtime.lastError) console.error('Error saving showFloatingOnHighlight', chrome.runtime.lastError);
        console.log('showFloatingOnHighlight set to', enabled);
      });
    });
  }

  if(preserveFormattingCheckbox){
    chrome.storage.local.get('rewriteWithFormat', (data) => {
        if (data.rewriteWithFormat !== undefined) {
            preserveFormattingCheckbox.checked = data.rewriteWithFormat;
        }else{
          chrome.storage.set({rewriteWithFormat:false})
        }
    });
  }

  if(geminiCloudModelToggle){
    chrome.storage.local.get("useCloudModel", (data)=>{
      console.log(data)
      if (data.useCloudModel !== undefined) {
        geminiCloudModelToggle.checked = data.useCloudModel;
        updateGeneralControlState(data.useCloudModel)
      }
    });
  }
});
