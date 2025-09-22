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

  // --- Sidebar host + shadow DOM ---
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
      .ts-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
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

      <hr>

      <button id="ts-rewrite-page" title="Rewrite the entire page using the selected profile">⚡ Rewrite Page</button>
      <button id="ts-undo-all" title="Undo all changes and restore the original page">⏪ Undo All</button>

      <div class="ts-toggle" title="Automatically rewrite every page you visit using the selected profile">
        <input type="checkbox" id="ts-auto-rewrite" />
        <label for="ts-auto-rewrite">Auto-Rewrite Pages</label>
      </div>

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
  const rewritePageBtn = qs("ts-rewrite-page");
  const undoAllBtn = qs("ts-undo-all");
  const autoRewriteToggle = qs("ts-auto-rewrite");

  // --- State ---
  let lastAIResponse = "";
  const undoStack = [];
  let placeholderMap = {}; // Make it accessible across listeners


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

  // --- Slider mapping functions ---
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

  // --- Gemini response listener ---
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type === "TS_GEMINI_RESPONSE") {
      lastAIResponse = event.data.text;

      // convert any omitted placeholder during aligning phase into html card
      lastAIResponse = convertOmittedPlaceHolders(lastAIResponse)

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

  // --- Recursive function to replace element nodes with placeholders while keeping text ---
 let placeholderIndex = 0;
  function replaceNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const innerText = Array.from(node.childNodes).map(replaceNodes).join("");

      const key = `_TS_TAG_${placeholderIndex}`;
      placeholderMap[key] = node.cloneNode(true);

      const marker = `${key}_START[${innerText}]${key}_END`;
      placeholderIndex++;

      return marker;
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return Array.from(node.childNodes).map(replaceNodes).join(" ");
    }
    return "";
  }

  // --- Preview selection rewrite ---
  previewBtn.addEventListener("click", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      outputBox.textContent = "No text selected.";
      return;
    }

    const selectionText = selection.toString().trim();
    if (!selectionText) {
      outputBox.textContent = "No text selected.";
      return;
    }

    setLoading(true);

    // Reset globals
    placeholderIndex = 0;
    placeholderMap = {};

    // Build text with placeholders
    const textWithPlaceholders = replaceNodes(selection.getRangeAt(0).cloneContents());
    //console.log("Text with placeholders:", textWithPlaceholders);
    // console.log("Placeholder map:", placeholderMap);

    const settings = {
      tone: mapTone(toneSlider.value),
      complexity: mapComplexity(complexitySlider.value),
      brevity: mapBrevity(brevitySlider.value),
    };

    // Send to AI (both versions)
    window.postMessage(
      {
        type: "TS_GEMINI_REQUEST",
        textWithPlaceholders: textWithPlaceholders.trim(),
        textWithoutPlaceholders: selectionText, // <-- raw version
        ...settings,
      },
      "*"
    );
  });


  
  // --- Apply selection rewrite (preserve styling with structured placeholders) ---
  applyBtn.addEventListener("click", () => {
    if (!lastAIResponse) {
      alert("No AI response to apply.");
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") return;

    const range = selection.getRangeAt(0);

    // Save original DOM for undo
    const originalNodes = range.cloneContents();
    undoStack.push({ range: range.cloneRange(), originalNodes });

    let reconstructedHTML = lastAIResponse;

    const tagRegex = /_TS_TAG_(\d+)_START\[(.*?)\]_TS_TAG_\1_END/g;

    // 🔁 Keep replacing until no more placeholders
    let iterations = 0;
    while (tagRegex.test(reconstructedHTML) && iterations < 50) {
      reconstructedHTML = reconstructedHTML.replace(tagRegex, (match, index, innerText) => {
        const key = `_TS_TAG_${index}`;
        const node = placeholderMap[key]?.cloneNode(true);

        if (node) {
          node.textContent = innerText;
          return node.outerHTML;
        }
        return innerText; // fallback
      });
      iterations++;
    }

    // 🧹 Final safeguard: strip any stray placeholders
    reconstructedHTML = reconstructedHTML.replace(/_TS_TAG_\d+_START\[?/g, "");
    reconstructedHTML = reconstructedHTML.replace(/\]?_TS_TAG_\d+_END/g, "");

    // Replace in DOM
    range.deleteContents();
    const fragment = document.createRange().createContextualFragment(reconstructedHTML);
    range.insertNode(fragment);

    selection.removeAllRanges();
  });

// --- Undo selection (restore original DOM nodes) ---
undoBtn.addEventListener("click", () => {
  if (undoStack.length === 0) {
    alert("Nothing to undo.");
    return;
  }

  const item = undoStack.pop();
  if (item.range && item.originalNodes) {
    item.range.deleteContents();
    const restored = item.originalNodes.cloneNode(true); // DocumentFragments are one-time use
    item.range.insertNode(restored);

    // Restore selection for better UX
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(item.range);
  }
});


  // --- Reset output ---
  resetBtn.addEventListener("click", () => {
    outputBox.textContent = "";
    lastAIResponse = "";
  });

  // --- Sidebar visibility ---
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
      }, 40000);
    } else {
      spinner.style.display = "none";
      previewBtn.disabled = false;
      applyBtn.disabled = false;
      undoBtn.disabled = false;
      resetBtn.disabled = false;
      if (setLoading._timeout) clearTimeout(setLoading._timeout);
    }
  }

  // --- Listen for popup commands ---
  chrome.runtime.onMessage.addListener((msg) => {
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

  // --- Rewrite page ---
  rewritePageBtn.addEventListener("click", async () => {
    console.log("🔄 Rewrite entire page requested");
    await rewritePageWithProfile();
  });

  // --- Undo All ---
  undoAllBtn.addEventListener("click", async () => {
    const proceed = confirm(
      "Undo All rewrites will reload the page. Any unsaved changes on this page will be lost. Continue?"
    );
    if (!proceed) return;

    console.log("↩️ Undo all: reloading page...");
    const data = await chrome.storage.local.get(["sidebarVisible"]);
    const wasSidebarVisible = data.sidebarVisible;

    await chrome.storage.local.set({
      skipAutoRewrite: true,
      restoreSidebar: wasSidebarVisible,
    });

    location.reload();
  });

  // --- Auto-Rewrite toggle ---
  chrome.storage.local.get(["autoRewrite"], (data) => {
    if (data.autoRewrite) autoRewriteToggle.checked = true;
  });

  autoRewriteToggle.addEventListener("change", async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ autoRewrite: enabled });
    console.log("⚙️ Auto-Rewrite Pages set to:", enabled);

    if (enabled) await rewritePageWithProfile();
  });

  // --- Sync autoRewrite toggle across contexts ---
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.autoRewrite && autoRewriteToggle) {
      autoRewriteToggle.checked = changes.autoRewrite.newValue;
    }
  });

  // --- Handle auto-rewrite on page load and restore sidebar ---
  chrome.storage.local.get(
    ["autoRewrite", "skipAutoRewrite", "restoreSidebar"],
    async (data) => {
      if (data.skipAutoRewrite) {
        await chrome.storage.local.set({ skipAutoRewrite: false });
        console.log("⚠️ Skipping auto-rewrite due to Undo All");
      } else if (data.autoRewrite) {
        console.log("⚡ Auto-Rewrite Pages active: rewriting page...");
        await rewritePageWithProfile();
      }

      if (data.restoreSidebar) {
        chrome.runtime.sendMessage({
          action: "toggleSidebar",
          visible: data.restoreSidebar,
        });
        await chrome.storage.local.set({ restoreSidebar: false });
      }
    }
  );

  // --- Page-wide Rewrite scaffolding ---
  async function rewritePageWithProfile() {
    console.log("⚙️ [rewritePageWithProfile] Starting rewrite...");

    const profile = {
      tone: mapTone(toneSlider.value),
      complexity: mapComplexity(complexitySlider.value),
      brevity: mapBrevity(brevitySlider.value),
    };

    const pageText = document.body.innerText;

    if (!pageText || pageText.trim().length < 20) {
      console.warn("⚠️ Not enough text content to rewrite.");
      return;
    }

    // TODO: Send pageText + profile to Gemini via window.postMessage
    // window.postMessage({ type: "TS_GEMINI_REQUEST", text: pageText, ...profile }, "*");

    console.log("Would rewrite page with profile:", profile);
  }

  function convertOmittedPlaceHolders(inputText) {
  const marker = "#omitted placeholders"; // marker as inserted by model in buildPromptAlign phase
  const markerIndex = inputText.indexOf(marker);

  if (markerIndex === -1) {
    console.error("No '#omitted placeholders' section found.");
    return inputText;
  }

  // Keep text above the marker
  const beforeMarker = inputText.slice(0, markerIndex).trim();

  // Get JSON text after the marker
  const afterMarker = inputText.slice(markerIndex + marker.length).trim();

  let placeholders;
  try {
    placeholders = JSON.parse(afterMarker);
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    return beforeMarker; // return only text if JSON parsing fails
  }

  // Build card HTML string
  let cardHTML = `
<div style="
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 5px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  max-width: 800px;
  margin: 10px auto;
">`;

  placeholders.forEach(item => {
    const key = item.split("_START")[0] // grab the key
    const node = placeholderMap[key]

    // only add nodes that are links in the cardhtml
    if (node instanceof HTMLAnchorElement) {
          cardHTML += `
            <div style="
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 4px 6px;
              font-size: 14px;
              text-align: center;
              background: #f5f5f5;
            ">${item}</div>`;
    }
  });

  cardHTML += "\n</div>";

  // Combine original text above marker + card HTML
  const finalText = beforeMarker + "\n\n" + cardHTML;
  return finalText;
}

})();
