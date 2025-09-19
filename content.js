(function () {
  if (document.getElementById("toneshift-sidebar-host")) return;

  console.log("ToneShift sidebar injected!");

  // --- Inject helper scripts into page context ---
  const loaderScript = document.createElement("script");
  loaderScript.type = "module";
  loaderScript.src = chrome.runtime.getURL("pageGeminiLoader.js");
  document.documentElement.appendChild(loaderScript);

  const hybridScript = document.createElement("script");
  hybridScript.src = chrome.runtime.getURL("pageHybrid.js");
  document.documentElement.appendChild(hybridScript);

  // --- Floating icon CSS ---
  const style = document.createElement("style");
  style.textContent = `
    .ts-modified {
      background-color: #cce5ff;
      border-radius: 2px;
      padding: 1px 2px;
    }
    #ts-floating-icon {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background-color: #007bff;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: bold;
      cursor: pointer;
      z-index: 999999;
    }
  `;
  document.head.appendChild(style);

  // --- Floating icon ---
  const floatingIcon = document.createElement("div");
  floatingIcon.id = "ts-floating-icon";
  floatingIcon.textContent = "TS";
  floatingIcon.style.display = "none";
  document.body.appendChild(floatingIcon);

  // --- Sidebar host + shadow ---
  const host = document.createElement("div");
  host.id = "toneshift-sidebar-host";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: sans-serif; }
      #toneshift-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 320px;
        height: 100%;
        background: white;
        border-left: 2px solid #ddd;
        z-index: 999999;
        box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        font-family: sans-serif;
        padding: 10px;
        overflow-y: auto;
      }
      h2 { margin-top: 0; }
      button {
        margin: 4px 2px;
        padding: 6px 10px;
        border: none;
        background: #007bff;
        color: white;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover { background: #0056b3; }
      input[type=range] { width: 100%; }
      hr { margin: 10px 0; }
      #ts-spinner .ts-loader {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
        margin: auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>

    <div id="toneshift-sidebar">
      <h2>ToneShift</h2>

      <button id="ts-hide-sidebar">Hide Sidebar</button><br>
      <button id="ts-set-key">🔑 Set Gemini API Key</button><br>
      <hr>

      <label>Profiles:</label>
      <select id="ts-profile-select"></select><br><br>
      <button id="ts-save-profile">Save</button>
      <button id="ts-edit-profile">Edit</button>
      <button id="ts-delete-profile">Delete</button>

      <hr>

      <label>Tone</label><input id="ts-tone" type="range" min="0" max="10"><br>
      <label>Complexity</label><input id="ts-complexity" type="range" min="0" max="10"><br>
      <label>Brevity</label><input id="ts-brevity" type="range" min="0" max="10"><br>

      <button id="ts-preview">Preview</button>
      <button id="ts-apply">Apply</button>
      <button id="ts-undo">Undo</button>
      <button id="ts-reset">Reset</button>

      <div id="ts-spinner" style="display:none; margin-top:10px; text-align:center;">
        <div class="ts-loader"></div>
      </div>

      <div id="ts-output" style="margin-top:10px; font-size:14px;"></div>
    </div>
  `;
  document.body.appendChild(host);

  // --- Grab elements from shadow ---
  const qs = (id) => shadow.getElementById(id);
  const sidebar = qs("toneshift-sidebar");
  const hideBtn = qs("ts-hide-sidebar");
  const setKeyBtn = qs("ts-set-key");
  const profileSelect = qs("ts-profile-select");
  const saveProfileBtn = qs("ts-save-profile");
  const editProfileBtn = qs("ts-edit-profile");
  const deleteProfileBtn = qs("ts-delete-profile");
  const toneSlider = qs("ts-tone");
  const complexitySlider = qs("ts-complexity");
  const brevitySlider = qs("ts-brevity");
  const previewBtn = qs("ts-preview");
  const applyBtn = qs("ts-apply");
  const undoBtn = qs("ts-undo");
  const resetBtn = qs("ts-reset");
  const spinner = qs("ts-spinner");
  const outputBox = qs("ts-output");

  // --- State ---
  let lastAIResponse = "";
  const undoStack = [];

  // --- Profiles ---
  const builtInPresets = {
    Default: { tone: 5, complexity: 5, brevity: 5 },
    "Kid Mode": { tone: 2, complexity: 2, brevity: 8 },
    Professional: { tone: 8, complexity: 9, brevity: 7 },
    Casual: { tone: 5, complexity: 5, brevity: 5 },
    Goggy: { tone: 6, complexity: 5, brevity: 6 },
    Lazy: { tone: 2, complexity: 2, brevity: 8 },
    "No Brain": { tone: 6, complexity: 2, brevity: 8 },
  };
  let userProfiles = {};

  async function loadProfiles() {
    const data = await chrome.storage.local.get("profiles");
    userProfiles = data.profiles || {};
    profileSelect.innerHTML = "";
    const allProfiles = { ...builtInPresets, ...userProfiles };
    for (const name of Object.keys(allProfiles)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      profileSelect.appendChild(option);
    }
  }
  loadProfiles();

  function applyProfile(profile) {
    toneSlider.value = profile.tone;
    complexitySlider.value = profile.complexity;
    brevitySlider.value = profile.brevity;
  }
  applyProfile(builtInPresets.Default);

  profileSelect.addEventListener("change", () => {
    const name = profileSelect.value;
    const profile = { ...builtInPresets[name], ...userProfiles[name] };
    if (profile) applyProfile(profile);
  });

  // --- Save / Edit / Delete profiles ---
  saveProfileBtn.addEventListener("click", async () => {
    const name = prompt("Enter profile name:");
    if (!name) return;
    const tone = Number(toneSlider.value);
    const complexity = Number(complexitySlider.value);
    const brevity = Number(brevitySlider.value);
    userProfiles[name] = { tone, complexity, brevity };
    await chrome.storage.local.set({ profiles: userProfiles });
    loadProfiles();
    profileSelect.value = name;
    alert(`Profile saved as "${name}"`);
  });

  editProfileBtn.addEventListener("click", async () => {
    const name = profileSelect.value;
    if (!name) return alert("Select a profile to edit.");
    userProfiles[name] = {
      tone: Number(toneSlider.value),
      complexity: Number(complexitySlider.value),
      brevity: Number(brevitySlider.value),
    };
    await chrome.storage.local.set({ profiles: userProfiles });
    loadProfiles();
    profileSelect.value = name;
    alert(`Profile "${name}" updated`);
  });

  deleteProfileBtn.addEventListener("click", async () => {
    const name = profileSelect.value;
    if (!name) return alert("Select a profile to delete.");
    if (!userProfiles[name]) return alert("Cannot delete built-in profile.");
    delete userProfiles[name];
    await chrome.storage.local.set({ profiles: userProfiles });
    loadProfiles();
  });

  // --- Mapping sliders ---
  function mapTone(v) {
    v = Number(v);
    if (v <= 2) return "neutral";
    if (v <= 4) return "slightly emotional";
    if (v <= 6) return "moderately emotional";
    if (v <= 8) return "very emotional";
    return "extremely emotional";
  }
  function mapComplexity(v) {
    v = Number(v);
    if (v <= 2) return "very simple";
    if (v <= 4) return "simple";
    if (v <= 6) return "moderately complex";
    if (v <= 8) return "complex";
    return "very complex";
  }
  function mapBrevity(v) {
    v = Number(v);
    if (v <= 2) return "very verbose";
    if (v <= 4) return "verbose";
    if (v <= 6) return "moderately concise";
    if (v <= 8) return "concise";
    return "very concise";
  }

  // --- Gemini responses ---
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type === "TS_GEMINI_RESPONSE") {
      lastAIResponse = event.data.text;
      outputBox.textContent = lastAIResponse;
      setLoading(false);
    }

    if (event.data.type === "TS_GEMINI_ERROR") {
      outputBox.textContent =
        "⚠️ Error: " + (event.data.error || "Something went wrong");
      lastAIResponse = "";
      setLoading(false);
    }
  });

  // --- Preview ---
  previewBtn.addEventListener("click", () => {
    const selection = window.getSelection().toString();
    if (!selection) return (outputBox.textContent = "No text selected.");

    setLoading(true);

    const settings = {
      tone: mapTone(toneSlider.value),
      complexity: mapComplexity(complexitySlider.value),
      brevity: mapBrevity(brevitySlider.value),
    };

    window.postMessage(
      { type: "TS_GEMINI_REQUEST", text: selection, ...settings },
      "*"
    );
  });

  // --- Apply ---
  applyBtn.addEventListener("click", () => {
    if (!lastAIResponse) return alert("No AI response to apply.");
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && selection.toString().trim() !== "") {
      const range = selection.getRangeAt(0);
      undoStack.push({ range: range.cloneRange(), originalText: range.toString() });
      range.deleteContents();
      const span = document.createElement("span");
      span.textContent = lastAIResponse;
      span.classList.add("ts-modified");
      range.insertNode(span);
      selection.removeAllRanges();
    }
  });

  // --- Undo ---
  undoBtn.addEventListener("click", () => {
    while (undoStack.length > 0) {
      const item = undoStack.pop();
      if (item.range)
        item.range.deleteContents(),
          item.range.insertNode(document.createTextNode(item.originalText));
    }
  });

  // --- Reset ---
  resetBtn.addEventListener("click", () => {
    outputBox.textContent = "";
    lastAIResponse = "";
  });

  // --- Hide / Show sidebar ---
  hideBtn.addEventListener("click", () => {
    sidebar.style.display = "none";
    floatingIcon.style.display = "flex";
    chrome.storage.local.set({ sidebarVisible: false });
  });

  floatingIcon.addEventListener("click", () => {
    sidebar.style.display = "block";
    floatingIcon.style.display = "none";
    chrome.storage.local.set({ sidebarVisible: true });
  });

  chrome.storage.local.get("sidebarVisible").then((data) => {
    if (data.sidebarVisible === false) {
      sidebar.style.display = "none";
      floatingIcon.style.display = "flex";
    } else {
      sidebar.style.display = "block";
      floatingIcon.style.display = "none";
    }
  });

  // --- Open popup for API key ---
  setKeyBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopup" });
  });

  // --- API key bridge ---
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data.type === "TS_GET_API_KEY") {
      const data = await chrome.storage.local.get("apiKey");
      window.postMessage(
        { type: "TS_API_KEY", apiKey: data.apiKey || null },
        "*"
      );
    }
  });

  // --- Spinner / disable buttons ---
  function setLoading(isLoading) {
    if (isLoading) {
      spinner.style.display = "block";
      previewBtn.disabled = true;
      applyBtn.disabled = true;
      undoBtn.disabled = true;
      resetBtn.disabled = true;

      if (setLoading._timeout) clearTimeout(setLoading._timeout);
      setLoading._timeout = setTimeout(() => {
        outputBox.textContent = "⚠️ Request timed out.";
        setLoading(false);
      }, 20000);
    } else {
      spinner.style.display = "none";
      previewBtn.disabled = false;
      applyBtn.disabled = false;
      undoBtn.disabled = false;
      resetBtn.disabled = false;
      if (setLoading._timeout) clearTimeout(setLoading._timeout);
    }
  }

  // Listen for popup commands
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "toggleSidebar") {
      if (msg.visible) {
        sidebar.style.display = "block";
        floatingIcon.style.display = "none";
      } else {
        sidebar.style.display = "none";
        floatingIcon.style.display = "flex";
      }
      chrome.storage.local.set({ sidebarVisible: msg.visible });
    }
  });

})();
