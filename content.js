(function () {
  if (document.getElementById("toneshift-sidebar")) return;

  console.log("ToneShift sidebar injected!");

  // Inject pageGeminiLoader.js
  const loaderScript = document.createElement("script");
  loaderScript.type = "module";
  loaderScript.src = chrome.runtime.getURL("pageGeminiLoader.js");
  document.documentElement.appendChild(loaderScript);

  /*
  // Inject pageGemini.js
  const geminiBridge = document.createElement("script");
  geminiBridge.src = chrome.runtime.getURL("pageGemini.js");
  document.documentElement.appendChild(geminiBridge);
  */
 // Inject pageHybrid.js
  const hybridScript = document.createElement("script");
  hybridScript.src = chrome.runtime.getURL("pageHybrid.js");
  document.documentElement.appendChild(hybridScript);


  // CSS for modified text and floating ts icon
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

  // Floating icon
  const floatingIcon = document.createElement("div");
  floatingIcon.id = "ts-floating-icon";
  floatingIcon.textContent = "TS";
  floatingIcon.style.display = "none";
  document.body.appendChild(floatingIcon);


  // Sidebar UI
  const sidebar = document.createElement("div");
  sidebar.id = "toneshift-sidebar";
  sidebar.style.cssText = `
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
  `;
  sidebar.innerHTML = `
    <h2>ToneShift</h2>

    <button id="ts-hide-sidebar">Hide Sidebar</button><br>
    <button id="ts-set-key">🔑 Set API Key</button><br>
    <hr>

    <!-- Profile section -->
    <label>Profiles:</label>
    <select id="ts-profile-select"></select><br><br>
    <button id="ts-save-profile">Save</button>
    <button id="ts-edit-profile">Edit</button>
    <button id="ts-delete-profile">Delete</button>

    <hr>
    
    <!-- Sliders -->
    <label>Tone</label><input id="ts-tone" type="range" min="0" max="10"><br>
    <label>Complexity</label><input id="ts-complexity" type="range" min="0" max="10"><br>
    <label>Brevity</label><input id="ts-brevity" type="range" min="0" max="10"><br>

    <button id="ts-preview">Preview</button>
    <button id="ts-apply">Apply</button>
    <button id="ts-undo">Undo</button>
    <button id="ts-reset">Reset</button>
    

    <div id="ts-output" style="margin-top:10px; font-size:14px;"></div>
  `;
  document.body.appendChild(sidebar);

  // Track AI response and undo stack
  let lastAIResponse = "";
  const undoStack = [];

  // Built-in presets
  //chrome.storage.local.set({profiles:{}})
  const builtInPresets = {
    "Default" : { tone: 5, complexity: 5, brevity: 5 },
    "Kid Mode": { tone: 2, complexity: 2, brevity: 8 },
    "Professional": { tone: 8, complexity: 9, brevity: 7 },
    "Casual": { tone: 5, complexity: 5, brevity: 5 },
    "Goggy": { tone: 6, complexity: 5, brevity: 6 },
    "Lazy": { tone: 2, complexity: 2, brevity: 8 },
    "No Brain" : { tone: 6, complexity: 2, brevity: 8 },
  };
  let userProfiles = {};
  const profileSelect = document.getElementById("ts-profile-select");

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
    document.getElementById("ts-tone").value = profile.tone;
    document.getElementById("ts-complexity").value = profile.complexity;
    document.getElementById("ts-brevity").value = profile.brevity;
    console.log(profile)
  }
  applyProfile(builtInPresets.Default)

  profileSelect.addEventListener("change", () => {
    const name = profileSelect.value;
    const profile = { ...builtInPresets[name], ...userProfiles[name] };
    if (profile) applyProfile(profile);
  });

  async function saveProfile(name) {
    if (!name) return;
    const tone = Number(document.getElementById("ts-tone").value);
    const complexity = Number(document.getElementById("ts-complexity").value);
    const brevity = Number(document.getElementById("ts-brevity").value);

    let finalName = name;
    let idx = 1;
    while (userProfiles[finalName] || builtInPresets[finalName]) {
      finalName = `${name}_${idx}`;
      idx++;
    }

    userProfiles[finalName] = { tone, complexity, brevity };
    await chrome.storage.local.set({ profiles: userProfiles });
    loadProfiles();
    profileSelect.value = finalName;
    alert(`Profile saved as "${finalName}"`);

    // apply the profile
    applyProfile(userProfiles[finalName])
  }
  async function editProfile() {
    const name = profileSelect.value;
    if (!name) return alert("Select a profile to edit.");
    const tone = Number(document.getElementById("ts-tone").value);
    const complexity = Number(document.getElementById("ts-complexity").value);
    const brevity = Number(document.getElementById("ts-brevity").value);
    userProfiles[name] = { tone, complexity, brevity };
    await chrome.storage.local.set({ profiles: userProfiles });
    loadProfiles();
    profileSelect.value = name;
    alert(`Profile "${name}" updated`);
  }
  async function deleteProfile() {
    const name = profileSelect.value;
    if (!name) return alert("Select a profile to delete.");
    if (!userProfiles[name]) return alert("Cannot delete built-in profile directly.");
    delete userProfiles[name];
    await chrome.storage.local.set({ profiles: userProfiles });
    loadProfiles();
  }
  document.getElementById("ts-save-profile").addEventListener("click", async () => {
    const name = prompt("Enter profile name:");
    if (name) saveProfile(name.trim());
  });
  document.getElementById("ts-edit-profile").addEventListener("click", editProfile);
  document.getElementById("ts-delete-profile").addEventListener("click", deleteProfile);

    // map settings to text meaning
  function mapTone(value) {
    value = Number(value); 
    if (value <= 2) return "neutral"; 
    if (value <= 4) return "slightly emotional"; 
    if (value <= 6) return "moderately emotional"; 
    if (value <= 8) return "very emotional"; return "extremely emotional"; 
  }
  function mapComplexity(value) {
    value = Number(value); 
    if (value <= 2) return "very simple"; 
    if (value <= 4) return "simple"; 
    if (value <= 6) return "moderately complex"; 
    if (value <= 8) return "complex"; return "very complex";
  }
  function mapBrevity(value) {
    value = Number(value);
    if (value <= 2) return "very verbose";
    if (value <= 4) return "verbose";
    if (value <= 6) return "moderately concise";
    if (value <= 8) return "concise"; return "very concise"; }

  // Gemini responses
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "TS_GEMINI_RESPONSE") {
      lastAIResponse = event.data.text;
      document.getElementById("ts-output").textContent = lastAIResponse;
    }
  });

  // Preview
  document.getElementById("ts-preview").addEventListener("click", () => {
    const selection = window.getSelection().toString();
    if (!selection) return document.getElementById("ts-output").textContent = "No text selected.";

    const settings = {
      tone: mapTone(document.getElementById("ts-tone").value),
      complexity: mapComplexity(document.getElementById("ts-complexity").value),
      brevity: mapBrevity(document.getElementById("ts-brevity").value)
    };

    window.postMessage({ type: "TS_GEMINI_REQUEST", text: selection, ...settings }, "*");
  });

  function replaceTextNodes(rootNode, replacementText) {
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT","STYLE"].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const replaced = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      replaced.push({ node, originalText: node.nodeValue });
      node.nodeValue = replacementText;
    }
    return replaced;
  }

  // Apply
  document.getElementById("ts-apply").addEventListener("click", () => {
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
    } else {
      const replacedNodes = replaceTextNodes(document.body, lastAIResponse);
      replacedNodes.forEach(n => {
        const span = document.createElement("span");
        span.textContent = n.node.nodeValue;
        span.classList.add("ts-modified");
        n.node.parentNode.replaceChild(span, n.node);
        undoStack.push({ node: span, originalText: n.originalText });
      });
    }
  });

  // Undo
  document.getElementById("ts-undo").addEventListener("click", () => {
    while (undoStack.length > 0) {
      const item = undoStack.pop();
      if (item.range) item.range.deleteContents(), item.range.insertNode(document.createTextNode(item.originalText));
      else if (item.node) item.node.replaceWith(document.createTextNode(item.originalText));
    }
  });

  // Reset
  document.getElementById("ts-reset").addEventListener("click", () => {
    document.getElementById("ts-output").textContent = "";
    lastAIResponse = "";
  });

    // Hide Sidebar button
  const hideBtn = document.getElementById("ts-hide-sidebar");
  hideBtn.addEventListener("click", () => {
    sidebar.style.display = "none";
    floatingIcon.style.display = "flex";
    hideBtn.textContent = "Show Sidebar";  // ✅ not "Hide"
    chrome.storage.local.set({ sidebarVisible: false });
  });

  // Floating icon click
  floatingIcon.addEventListener("click", () => {
    sidebar.style.display = "block";
    floatingIcon.style.display = "none";
    hideBtn.textContent = "Hide Sidebar";  // ✅ keep in sync
    chrome.storage.local.set({ sidebarVisible: true });
  });

  // Load sidebar visibility
  chrome.storage.local.get("sidebarVisible").then((data) => {
    if (data.sidebarVisible === false) {
      sidebar.style.display = "none";
      floatingIcon.style.display = "flex";
      hideBtn.textContent = "Show Sidebar";
    } else {
      sidebar.style.display = "block";
      floatingIcon.style.display = "none";
      hideBtn.textContent = "Hide Sidebar";
    }
  });

  // set api key click
  document.getElementById("ts-set-key").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopup" });
  });


  // Bridge API key requests from page script
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


})();
