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
    
     /* Floating action button for text selection */
    .ts-floating-preview-btn {
      /*position: absolute;*/
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 1000000;
      display: block;
      font-family: sans-serif;
      font-weight: bold;
      white-space: nowrap;
    }
    .ts-floating-preview-btn:hover {
      background: #0056b3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }

    .ts-fpb-container{
      position: absolute;
      border: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 1000000;
      display: none;
      grid-template-columns: 1fr; /* This creates a single column */
      gap: 5px; /* Optional: adds space between the button and the icon */

    }
      
  .ts-preview-container {
    border-radius: 3px;
    padding: 1px 3px;
    border: 1px dashed #ffd54f !important;
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px; /* Optional: adds space between the rows */
  }

  .ts-preview-container .ts-preview-text-highlight {
    background-color: #fff9c4 !important;
    border-radius: 3px;
    padding: 1px 3px;
    position: relative;
    display: inline; /* keep inline behavior */
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }


  /* Revert button locked to top-right corner */
  .ts-revert-button {
    background: #ff2600ff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    z-index: 10;
    display: none;
    font-family: sans-serif;
    font-weight: bold;
    line-height: 1;
    white-space: nowrap;

    /* Grid-specific positioning */
    justify-self: end;  /* Aligns the item to the right edge of its grid cell */
    align-self: start;   /* Aligns the item to the top edge of its grid cell */

    /* Initial state: make it slightly transparent */
    opacity: 0.5;
    
    /* Add a smooth transition for a better user experience */
    transition: opacity 0.3s ease-in-out;
  }

  .ts-revert-button:hover {
    background: #ff2600ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    opacity: 1;
  }

    /* Spinner styling */
  .ts-await-rewrite-spinner {
    position: fixed; /* relative to viewport */
    width: 24px;
    height: 24px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 70%;
    animation: ts-spin 0.8s linear infinite;
    z-index: 999999;
    display: none;
  }
  /* Keyframes for spin */
  @keyframes ts-spin {
    to { transform: rotate(360deg); }
  }

    /* Highlighted text while processing */
    .ts-processing-highlight {
      background-color: rgba(255, 38, 0, 0.15);
      outline: 1px solid rgba(255, 38, 0, 0.4);
    }
  `;

  document.head.appendChild(style);

  // --- Floating icon ---
  const floatingIcon = document.createElement("div");
  floatingIcon.id = "ts-floating-icon";
  floatingIcon.textContent = "TS";
  floatingIcon.style.display = "none";
  document.body.appendChild(floatingIcon);

  // --- Floating preview button ---
  const floatingPreviewBtn = document.createElement("button");
  floatingPreviewBtn.className = "ts-floating-preview-btn";
  floatingPreviewBtn.textContent = "🔍 Rewrite";
  floatingPreviewBtn.title = "Preview text transformation with ToneShift";
  //document.body.appendChild(floatingPreviewBtn);

  const fPBContainer = document.createElement("div")
  fPBContainer.className = "ts-fpb-container"
  fPBContainer.appendChild(floatingPreviewBtn)
  document.body.appendChild(fPBContainer)


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
      
      /* Advanced section styles */
      #ts-advanced-toggle {
        background: transparent;
        border: 1px solid #007bff;
        color: #007bff;
        width: 100%;
        margin: 10px 0;
      }
      #ts-advanced-toggle:hover {
        background: #f0f8ff;
      }
      #ts-advanced-controls {
        background: #f8f9fa;
        border-radius: 6px;
        padding: 10px;
        margin: 5px 0;
        border-left: 3px solid #007bff;
      }
      #ts-advanced-controls label {
        font-weight: bold;
        color: #495057;
      }

      .setting-with-tooltip {
        position: relative; /* This is crucial for positioning the tooltip relative to its container */
        display: inline-block;
        cursor: help; /* This changes the cursor to indicate it's a help/info element */
      }

      .tooltip {
        visibility: hidden;
        width: 200px;
        background-color: #555;
        color: #fff;
        text-align: center;
        border-radius: 6px;
        padding: 5px;
        position: absolute;
        z-index: 1;
        bottom: 125%; /* Position the tooltip above the text */
        left: 50%;
        margin-left: -100px; /* Center the tooltip */
        opacity: 0;
        transition: opacity 0.3s;
      }

      .setting-with-tooltip:hover .tooltip {
        visibility: visible;
        opacity: 1;
      }

      /* Optional: Add an arrow to the tooltip */
      .tooltip::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: #555 transparent transparent transparent;
      }
    </style>

    <div id="toneshift-sidebar">
      <h2>ToneShift</h2>

      <button id="ts-hide-sidebar">Hide Sidebar</button><br>
      
      <hr>

      <label for="ts-mode-select">Mode:</label>
      <select id="ts-mode-select">
        <!-- Options will be populated dynamically -->
      </select>

      <button id="ts-advanced-toggle">⚙️ Advanced Options</button>

      <div id="ts-advanced-controls" style="display: none;">
        <label>Custom Modes:</label>
        <select id="ts-profile-select"></select><br><br>
        <button id="ts-save-profile">Save Current</button>
        <button id="ts-edit-profile">Edit Selected</button>
        <button id="ts-delete-profile">Delete</button>

        <hr>

        <label>Tone: <span id="ts-tone-value">Neutral</span></label>
        <input id="ts-tone" type="range" min="0" max="10" value="5"><br>
        
        <label>Complexity: <span id="ts-complexity-value">Medium</span></label>
        <input id="ts-complexity" type="range" min="0" max="10" value="5"><br>
        
        <label>Brevity: <span id="ts-brevity-value">Medium</span></label>
        <input id="ts-brevity" type="range" min="0" max="10" value="5"><br>

        <hr><br>
        <h3>Model Settings</h3>
        <div class="setting-with-tooltip">
          <input type="checkbox" id="ts-preserve-formatting">
          <label for="ts-preserve-formatting">Maintain page original formatting</label>
          <span class="tooltip" role="tooltip">
            Preserve existing text styling, bold, italics, links, and other HTML formatting.<br>
            <span>Note: When enabled, rewrites can take more time and also more token consumption when
            using a Gemini API key.</span>
          </span>
        </div>
        <br><br>

        <label for="gemini-cloud-model-toggle">Use Cloud Gemini Model</label>
        <button id="ts-set-key">🔑 Set Gemini API Key</button><br>
      </div>

      <hr>

      <button id="ts-preview">Preview</button>
      <button id="ts-apply">Apply</button>
      <button id="ts-undo">Undo</button>
      <button id="ts-reset">Reset</button>

      <hr>

      <!-- comment out rewrite page , undo all button, and auto-rewrite checkbox -->
      <!--
      <button id="ts-rewrite-page" title="Rewrite the entire page using the selected profile">⚡ Rewrite Page</button>
      <button id="ts-undo-all" title="Undo all changes and restore the original page">⏪ Undo All</button>

      <div class="ts-toggle" title="Automatically rewrite every page you visit using the selected profile">
        <input type="checkbox" id="ts-auto-rewrite" />
        <label for="ts-auto-rewrite">Auto-Rewrite Pages</label>
      </div>
      -->



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
  const modeSelect = qs("ts-mode-select");
  const advancedToggle = qs("ts-advanced-toggle");
  const advancedControls = qs("ts-advanced-controls");
  const customModeSelect = qs("ts-profile-select");
  const saveProfileBtn = qs("ts-save-profile");
  const editProfileBtn = qs("ts-edit-profile");
  const deleteProfileBtn = qs("ts-delete-profile");
  const toneSlider = qs("ts-tone");
  const complexitySlider = qs("ts-complexity");
  const brevitySlider = qs("ts-brevity");
  const toneValue = qs("ts-tone-value");
  const complexityValue = qs("ts-complexity-value");
  const brevityValue = qs("ts-brevity-value");
  const previewBtn = qs("ts-preview");
  const applyBtn = qs("ts-apply");
  const undoBtn = qs("ts-undo");
  const resetBtn = qs("ts-reset");
  const spinner = qs("ts-spinner");
  const outputBox = qs("ts-output");
  const rewritePageBtn = qs("ts-rewrite-page");
  const undoAllBtn = qs("ts-undo-all");
  const autoRewriteToggle = qs("ts-auto-rewrite");
  const preserveFormattingCheckbox = qs('ts-preserve-formatting');

  

  undoBtn.style.display = "none" // hide sidebar undoBtn
  applyBtn.style.display = "none" // hide sidebar applyBtn

  // --- State ---
  let lastAIResponse = "";
  const undoStack = [];
  const rewriteMap = {}
  let placeholderMap = {};
  let mapKeyPool = 0
  let rewriteWithFormat = false
  
  // Inline preview state
  let isPreviewMode = false;
  let previewRange = null;
  let previewOriginalContent = null;
  let currentPreviewElement = null;

  // Floating button state - FIXED: Use object to store both range and rect
  let floatingButtonState = {
    range: null,
    rect: null
  };

  // --- Profiles ---
  const builtInPresets = {
    "Kid Mode": { tone: 2, complexity: 2, brevity: 8 },
    "No Brain": { tone: 6, complexity: 2, brevity: 8 },
    "Casual": { tone: 5, complexity: 5, brevity: 5 },
    "Lazy": { tone: 2, complexity: 2, brevity: 8 },
    "Professional": { tone: 8, complexity: 9, brevity: 7 },
    "Goggy": { tone: 6, complexity: 5, brevity: 6 },
    
  };
  let userProfiles = {};

  // Mode display names mapping
  const modeDisplayNames = {
    "Kid Mode": "Simplify",
    "No Brain": "Easy Read",
    "Casual": "Casual",
    "Lazy": "Shorten",
    "Professional": "Formalize", 
    "Goggy": "Creative"
  };

  // --- Text Selection and Floating Button Logic - COMPLETELY REWRITTEN ---
  function showFloatingPreviewButton(range, rect) {
    if (!range || !rect) {
      hideFloatingPreviewButton();
      return;
    }

    //console.log("Showing floating button at:", rect);
    
    // Store both range and rect for later use
    floatingButtonState.range = range.cloneRange();
    floatingButtonState.rect = rect;

    // Position button near selection - FIXED: Use fixed positioning correctly
    fPBContainer.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    fPBContainer.style.left = (rect.left + window.scrollX) + 'px';
    fPBContainer.style.display = 'grid';

    const n = fPBContainer.querySelector("#floating-mode-dropdown")
    if (!n){
      // mode selection icon
      const clonedNode = modeSelect.cloneNode(true);
      clonedNode.style.zIndex = "1000001";
      clonedNode.id = "floating-mode-dropdown";

      const modeOption = clonedNode.querySelector("#ts-mode-option")

      modeOption.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isMouseDownOnButton = true;
      });

      modeOption.addEventListener('mouseup', (e) => {
        isMouseDownOnButton = false;
      });

      clonedNode.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isMouseDownOnButton = true;
      });

      clonedNode.addEventListener('mouseup', (e) => {
        e.stopPropagation()
        isMouseDownOnButton = false;
      });
      
        fPBContainer.appendChild(clonedNode)
    }

  }

  function hideFloatingPreviewButton() {
    //const n = fPBContainer.querySelector("#floating-mode-dropdown")
    //n?.remove()

    fPBContainer.style.display = 'none';
    floatingButtonState.range = null;
    floatingButtonState.rect = null;
  }

  // --- create Revert Button ---
  function createRevertPreviewBtn() {
    const revertPreviewBtn = document.createElement("button");
    revertPreviewBtn.textContent = "Back to original text";
    revertPreviewBtn.className = "ts-revert-button";
    revertPreviewBtn.title = "Revert to original text";
    revertPreviewBtn.style.display = "block"; // show by default when created

    // Position button rewritten text selection
    //revertPreviewBtn.style.top = (rect.top + window.scrollY + 10) + 'px';
    //revertPreviewBtn.style.right = (rect.right + window.scrollX) + 'px';

    return revertPreviewBtn;
  }

  // ################# Spinner when awaiting AI rewrite ###########################
  const globalSpinner = document.createElement("div"); // One global spinner
  globalSpinner.className = "ts-await-rewrite-spinner";
  document.body.appendChild(globalSpinner);

  let spinnerActive = false;
  let trackedRect = null; // persistent rect snapshot

  // Update spinner position based on stored rect
  function updateSpinnerPosition() {
    if (!spinnerActive || !trackedRect) return;

    const rect = trackedRect.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;

    globalSpinner.style.top = rect.top + rect.height / 2 - 12 + "px";
    globalSpinner.style.left = rect.left + rect.width / 2 - 12 + "px";
  }

  /**
   * Toggle spinner visibility centered on the initial selection rect.
   * Once enabled, spinner keeps tracking that rect even if selection is cleared.
   * @param {Selection} selection - window.getSelection()
   * @param {Boolean} enable - true = show, false = hide
   */
  function toggleSpinner(selection, enable) {
    if (enable) {
      if (!selection || selection.rangeCount === 0) return;

      // Capture the range so we can keep tracking after deselection
      const range = selection.getRangeAt(0).cloneRange();
      trackedRect = range; // store persistent Range

      spinnerActive = true;
      globalSpinner.style.display = "block";

      // Initial positioning
      updateSpinnerPosition();

      // Keep updating on scroll/resize
      const reposition = () => updateSpinnerPosition();
      window.addEventListener("scroll", reposition, true);
      window.addEventListener("resize", reposition);

      globalSpinner._cleanup = () => {
        window.removeEventListener("scroll", reposition, true);
        window.removeEventListener("resize", reposition);
      };
    } else {
      spinnerActive = false;
      trackedRect = null;
      globalSpinner.style.display = "none";

      if (globalSpinner._cleanup) {
        globalSpinner._cleanup();
        globalSpinner._cleanup = null;
      }
    }
  }
  // ################# END - Spinner when awaiting AI rewrite ###########################


  // Listen for text selection - FIXED: Better event handling
  let isMouseDownOnButton = false;

  floatingPreviewBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isMouseDownOnButton = true;
  });

  floatingPreviewBtn.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    isMouseDownOnButton = false;
  });

  document.addEventListener('mousedown', (e) => {
    // Only hide if not clicking on the button itself
    if (!isMouseDownOnButton && !fPBContainer.contains(e.target)) {
      hideFloatingPreviewButton();
    }
  });

  document.addEventListener('mouseup', (e) => {
    // Don't process if clicking on ToneShift UI or the floating button
    if (e.target.closest('#toneshift-sidebar-host') || 
        e.target === floatingPreviewBtn ||
        isMouseDownOnButton) {
        //console.log("clicking inside. isMouseDownOnButton: ", isMouseDownOnButton)

          return;

    }
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 5) {
      //console.log("selected some text")
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Only show if selection is substantial and visible
      if (rect.width > 50 || rect.height > 10) {
        // Small delay to ensure selection is complete
        setTimeout(() => {
          // Re-check selection hasn't changed
          const currentSelection = window.getSelection();
          if (currentSelection.toString().trim() === selectedText) {
            showFloatingPreviewButton(range, rect);
          }
        }, 500);
      } else {
        console.log("hidding the floating button")
        hideFloatingPreviewButton();
      }
    } else {
      hideFloatingPreviewButton();
    }
  });

  // Floating button click handler - FIXED: Use stored state
  floatingPreviewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    //console.log("Floating button clicked, stored range:", floatingButtonState.range);
    
    if (floatingButtonState.range) {
      // Create a selection from the stored range
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(floatingButtonState.range.cloneRange());
      
      // Use the same preview logic
      performPreview(selection);
      hideFloatingPreviewButton();
    } else {
      console.error("No preview range available");
    }
  });

    // Add a change event listener to the checkbox
  preserveFormattingCheckbox.addEventListener('change', (event) => {
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

  // Load the saved state when the popup/page opens
  // This ensures the checkbox reflects the user's last choice
  window.addEventListener('load', () => {
      chrome.storage.local.get('rewriteWithFormat', (data) => {
          if (data.rewriteWithFormat !== undefined) {
              preserveFormattingCheckbox.checked = data.rewriteWithFormat;
          }
      });
  });

  // --- Common Preview Function ---
  function performPreview(selection) {
    const selectionText = selection.toString().trim();
    if (!selectionText) {
      outputBox.textContent = "No text selected.";
      return;
    }

    //console.log("Performing preview on selection:", selectionText.substring(0, 50) + "...");

    // Clear any existing preview
    //clearInlinePreview();

    // Store selection info for inline preview
    isPreviewMode = true;
    previewRange = selection.getRangeAt(0).cloneRange();
    previewOriginalContent = previewRange.cloneContents();
    

    toggleSpinner(selection, true)
    setLoading(true);

    // Reset globals
    placeholderIndex = 0;
    placeholderMap = {};

    // Build text with placeholders
    const textWithPlaceholders = replaceNodes(selection.getRangeAt(0).cloneContents());

    const settings = {
      tone: mapTone(toneSlider.value),
      complexity: mapComplexity(complexitySlider.value),
      brevity: mapBrevity(brevitySlider.value),
    };

    // Send to AI
    window.postMessage(
      {
        type: "TS_GEMINI_REQUEST",
        textWithPlaceholders: textWithPlaceholders.trim(),
        textWithoutPlaceholders: selectionText,
        rewriteWithFormat:preserveFormattingCheckbox.checked,
        ...settings,
      },
      "*"
    );
  }

  // --- Profile Loading - FIXED: Properly include user profiles ---
  async function loadProfiles() {
    const data = await chrome.storage.local.get("profiles");
    userProfiles = data.profiles || {};
    
    // Clear and rebuild both dropdowns
    customModeSelect.innerHTML = "";
    modeSelect.innerHTML = "";
    
    // Add built-in presets to both dropdowns
    Object.keys(builtInPresets).forEach(name => {
      // Add to custom mode dropdown
      /*
      const profileOption = document.createElement("option");
      profileOption.value = name;
      profileOption.textContent = modeDisplayNames[name] || name;
      customModeSelect.appendChild(profileOption);
      */
      
      // Add to mode dropdown
      const modeOption = document.createElement("option");
      modeOption.id = "ts-mode-option"
      modeOption.value = name;
      modeOption.textContent = modeDisplayNames[name] || name;
      modeSelect.appendChild(modeOption);
    });
    
    // Add user profiles to both dropdowns
    Object.keys(userProfiles).forEach(name => {
      //console.log("::",name)
      // Add to custom mode dropdown
      const profileOption = document.createElement("option");
      profileOption.value = name;
      profileOption.textContent = name + " (Custom)";
      customModeSelect.appendChild(profileOption);
      
      // Add to mode dropdown
      const modeOption = document.createElement("option");
      modeOption.value = name;
      modeOption.textContent = name + " (Custom)";
      modeSelect.appendChild(modeOption);
    });
    
    // Set default selection
    if (modeSelect.options.length > 0) {
      modeSelect.value = "Kid Mode";
    }
    if (customModeSelect.options.length > 0) {
      //console.log("::",customModeSelect.options[0].name)
      customModeSelect.value = customModeSelect.options[0].name;
    }
    
    //console.log("Profiles loaded. Built-in:", Object.keys(builtInPresets).length, 
                //"User:", Object.keys(userProfiles).length);
  }

  function applyProfile(profile) {
    toneSlider.value = profile.tone;
    complexitySlider.value = profile.complexity;
    brevitySlider.value = profile.brevity;
    updateSliderValues();
  }
  
  function updateSliderValues() {
    toneValue.textContent = mapTone(toneSlider.value);
    complexityValue.textContent = mapComplexity(complexitySlider.value);
    brevityValue.textContent = mapBrevity(brevitySlider.value);
  }

  // Initialize with default profile
  loadProfiles().then(() => {
    applyProfile(builtInPresets["Kid Mode"]);
  });

  // --- Mode Select Event Listener ---
  modeSelect.addEventListener("change", (e) => {
    e.stopPropagation()
    const modeName = modeSelect.value;
    const profile = { ...builtInPresets[modeName], ...userProfiles[modeName] };
    if (profile) {
      applyProfile(profile);
      customModeSelect.value = modeName;
    }
  });

// --- Advanced Toggle Event Listener ---
  advancedToggle.addEventListener("click", () => {
    const isVisible = advancedControls.style.display === "block";
    advancedControls.style.display = isVisible ? "none" : "block";
    advancedToggle.textContent = isVisible ? "⚙️ Advanced Options" : "⚙️ Hide Advanced";
  });

  // --- Slider value update listeners ---
  toneSlider.addEventListener("input", updateSliderValues);
  complexitySlider.addEventListener("input", updateSliderValues);
  brevitySlider.addEventListener("input", updateSliderValues);

  customModeSelect.addEventListener("change", () => {
    const name = customModeSelect.value;
    const profile = { ...builtInPresets[name], ...userProfiles[name] };
    if (profile) applyProfile(profile);
  });

  // --- Save / Edit / Delete profiles - FIXED: Reload both dropdowns after changes ---
  saveProfileBtn.addEventListener("click", async () => {
    const name = prompt("Enter profile name:");
    if (!name) return;
    const tone = Number(toneSlider.value);
    const complexity = Number(complexitySlider.value);
    const brevity = Number(brevitySlider.value);
    userProfiles[name] = { tone, complexity, brevity };
    await chrome.storage.local.set({ profiles: userProfiles });
    await loadProfiles(); // Reload both dropdowns
    customModeSelect.value = name;
    modeSelect.value = name;
    alert(`Profile saved as "${name}"`);
  });

  editProfileBtn.addEventListener("click", async () => {
    const name = customModeSelect.value;
    if (!name) return alert("Select a profile to edit.");
    userProfiles[name] = {
      tone: Number(toneSlider.value),
      complexity: Number(complexitySlider.value),
      brevity: Number(brevitySlider.value),
    };
    await chrome.storage.local.set({ profiles: userProfiles });
    await loadProfiles(); // Reload both dropdowns
    customModeSelect.value = name;
    modeSelect.value = name;
    alert(`Profile "${name}" updated`);
  });

  deleteProfileBtn.addEventListener("click", async () => {
    const name = customModeSelect.value;
    if (!name) return alert("Select a profile to delete.");
    if (!userProfiles[name]) return alert("Cannot delete built-in profile.");
    delete userProfiles[name];
    await chrome.storage.local.set({ profiles: userProfiles });
    await loadProfiles(); // Reload both dropdowns
    alert(`Profile "${name}" deleted`);
  });

  // --- Slider mapping functions ---
  function mapTone(v) {
    v = Number(v);
    if (v <= 2) return "Casual";
    if (v <= 4) return "Neutral";
    if (v <= 6) return "Professional";
    if (v <= 8) return "Formal";
    return "Very Formal";
  }
  function mapComplexity(v) {
    v = Number(v);
    if (v <= 2) return "Simple";
    if (v <= 4) return "Basic";
    if (v <= 6) return "Medium";
    if (v <= 8) return "Complex";
    return "Expert";
  }
  function mapBrevity(v) {
    v = Number(v);
    if (v <= 2) return "Detailed";
    if (v <= 4) return "Verbose";
    if (v <= 6) return "Medium";
    if (v <= 8) return "Concise";
    return "Very Short";
  }

  // --- Gemini response listener ---
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data.type === "TS_GEMINI_RESPONSE") {
      lastAIResponse = event.data.text;
      lastAIResponse = convertOmittedPlaceHolders(lastAIResponse);

      if (isPreviewMode) {
        applyInlinePreview(lastAIResponse);
        isPreviewMode = false;
      } else {
        outputBox.textContent = lastAIResponse;
      }
      
      setLoading(false);
      toggleSpinner(null, false)
    }

    if (event.data.type === "TS_GEMINI_ERROR") {
      outputBox.textContent = "⚠️ Error: " + (event.data.error || "Something went wrong");
      lastAIResponse = "";
      setLoading(false);
      toggleSpinner(null, false)

      
      if (isPreviewMode) {
        isPreviewMode = false;
        previewRange = null;
        previewOriginalContent = null;
      }
    }
  });

  // --- Enhanced Inline Preview Functions - FIXED ---
  function applyInlinePreview(aiResponse) {
    if (!previewRange || !previewOriginalContent) {
      console.error("No preview range or content available");
      return;
    }

    try {
      //clearInlinePreview();
      hideFloatingPreviewButton()

      // Use the same reconstruction logic as the Apply button
      let reconstructedHTML = aiResponse;
      const tagRegex = /_TS_TAG_(\d+)_START\[(.*?)\]_TS_TAG_\1_END/g;

      let iterations = 0;
      while (tagRegex.test(reconstructedHTML) && iterations < 50) {
        reconstructedHTML = reconstructedHTML.replace(tagRegex, (match, index, innerText) => {
          const key = `_TS_TAG_${index}`;
          const node = placeholderMap[key]?.cloneNode(true);

          if (node) {
            node.textContent = innerText;
            return node.outerHTML;
          }
          return innerText;
        });
        iterations++;
      }

      // Clean up any stray placeholders
      reconstructedHTML = reconstructedHTML.replace(/_TS_TAG_\d+_START\[?/g, "");
      reconstructedHTML = reconstructedHTML.replace(/\]?_TS_TAG_\d+_END/g, "");

      // Create preview container - FIXED: Ensure highlight class is applied
      const previewContainer = document.createElement("span");
      previewContainer.className = "ts-preview-container";
      
      // Insert the reconstructed content
      const fragment = document.createRange().createContextualFragment(reconstructedHTML);
      const textContainer = document.createElement("span")
      textContainer.appendChild(fragment)
      textContainer.className = "ts-preview-text-highlight"

      //const range = selection.getRangeAt(0);
      //const rect = range.getBoundingClientRect();

      // create revert button
      const revertButton = createRevertPreviewBtn()
      const mapKey = getMapKey()
      revertButton.id = mapKey
      revertButton.addEventListener("click", (e) => {
        e.stopPropagation();
        //revertInlinePreview();
        //console.log("rewrite map: ", rewriteMap)
        const {range, originalNodes} = rewriteMap[revertButton.id]
        range.deleteContents();
        const restored = originalNodes.cloneNode(true);
        range.insertNode(restored);

        // delete from rewriteMap
        delete rewriteMap[revertButton.id]

        // Clear state
        previewRange = null;
        previewOriginalContent = null;
        isPreviewMode = false;
      });

      previewContainer.appendChild(revertButton);
      previewContainer.appendChild(textContainer);


      // Replace the content
      undoStack.push({range:previewRange, originalNodes:previewOriginalContent})
      rewriteMap[mapKey] = {range:previewRange, originalNodes:previewOriginalContent}
      previewRange.deleteContents();
      previewRange.insertNode(previewContainer);

      currentPreviewElement = previewContainer;
      console.log("Inline preview applied with HTML reconstruction");

    } catch (error) {
      console.error("Error applying inline preview:", error);
      outputBox.textContent = aiResponse;
    }
  }

  function revertInlinePreview() {
    if (!previewRange || !previewOriginalContent) return;

    try {
      clearInlinePreview();

      // Use the same restoration logic as the Undo button
      previewRange.deleteContents();
      const restored = previewOriginalContent.cloneNode(true);
      previewRange.insertNode(restored);

      // Clear state
      previewRange = null;
      previewOriginalContent = null;
      isPreviewMode = false;

      console.log("Inline preview reverted with proper DOM restoration");
    } catch (error) {
      console.error("Error reverting inline preview:", error);
    }
  }

  function clearInlinePreview() {
    if (currentPreviewElement) {
      currentPreviewElement.remove();
      currentPreviewElement = null;
    }
  }

  function getMapKey(){
    mapKeyPool += 1
    return mapKeyPool.toString()
  }

  // --- Preview selection rewrite ---
  previewBtn.addEventListener("click", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      outputBox.textContent = "No text selected.";
      return;
    }
    performPreview(selection);
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

  // --- Apply selection rewrite ---
  applyBtn.addEventListener("click", () => {
    if (!lastAIResponse) {
      alert("No AI response to apply.");
      return;
    }

    clearInlinePreview();
    isPreviewMode = false;
    previewRange = null;
    previewOriginalContent = null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") return;

    const range = selection.getRangeAt(0);
    const originalNodes = range.cloneContents();
    undoStack.push({ range: range.cloneRange(), originalNodes });

    let reconstructedHTML = lastAIResponse;
    const tagRegex = /_TS_TAG_(\d+)_START\[(.*?)\]_TS_TAG_\1_END/g;

    let iterations = 0;
    while (tagRegex.test(reconstructedHTML) && iterations < 50) {
      reconstructedHTML = reconstructedHTML.replace(tagRegex, (match, index, innerText) => {
        const key = `_TS_TAG_${index}`;
        const node = placeholderMap[key]?.cloneNode(true);

        if (node) {
          node.textContent = innerText;
          return node.outerHTML;
        }
        return innerText;
      });
      iterations++;
    }

    reconstructedHTML = reconstructedHTML.replace(/_TS_TAG_\d+_START\[?/g, "");
    reconstructedHTML = reconstructedHTML.replace(/\]?_TS_TAG_\d+_END/g, "");

    range.deleteContents();
    const fragment = document.createRange().createContextualFragment(reconstructedHTML);
    range.insertNode(fragment);

    selection.removeAllRanges();
  });

  // --- Undo selection ---
  undoBtn.addEventListener("click", () => {
    if (undoStack.length === 0) {
      alert("Nothing to undo.");
      return;
    }

    const item = undoStack.pop();
    if (item.range && item.originalNodes) {
      item.range.deleteContents();
      const restored = item.originalNodes.cloneNode(true);
      item.range.insertNode(restored);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(item.range);
    }
  });

 // --- Reset output ---
  resetBtn.addEventListener("click", () => {
    outputBox.textContent = "";
    lastAIResponse = "";
    
    // Also clear any active preview
    clearInlinePreview();
    isPreviewMode = false;
    previewRange = null;
    previewOriginalContent = null;
  });

  // --- Sidebar visibility ---
  function hideSideBar(){
    sidebar.style.display = "none";
    floatingIcon.style.display = "flex";
    chrome.storage.local.set({ sidebarVisible: false });
  }
  hideBtn.addEventListener("click", () => {
    hideSideBar()
  });
  /*
  document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('toneshift-sidebar');
    if (sidebar) {
      window.addEventListener('click', (event) => {
        if (event.target !== sidebar && !sidebar.contains(event.target)) {
          console.log('Click is outside the sidebar. Hiding the sidebar.');
          hideSideBar()
        }
      });
    } else {
      console.error('The element with ID "toneshift-sidebar" was not found.');
    }
  });
  */

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
        
        // Reset preview state on timeout
        /*
        if (isPreviewMode) {
          isPreviewMode = false;
          previewRange = null;
          previewOriginalContent = null;
        }
        */
      }, 100000);
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

  /*
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
    */

  function convertOmittedPlaceHolders(inputText) {
    const marker = "#omitted placeholders"; 
    const markerIndex = inputText.indexOf(marker);
    let hasLink = false;

    if (markerIndex === -1) {
      console.log("No '#omitted placeholders' section found.");
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
      return beforeMarker; 
    }

    // Build compact card HTML string with smaller header
    let cardHTML = `
<div style="max-width: 800px; margin: 4px auto 10px; font-family: sans-serif;">
  <h5 style="margin: 2px 0 4px; font-size: 13px; color: #555;">Related links</h5>
  <div style="
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 4px;
    padding: 6px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  ">`;

    placeholders.forEach(item => {
      const key = item.split("_START")[0]; // grab the key
      const node = placeholderMap[key];

      // only add nodes that are links in the cardHTML
      if (node instanceof HTMLAnchorElement) {
        hasLink = true;
        cardHTML += `
      <div style="
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 3px 5px;
        font-size: 12px;
        text-align: center;
        background: #f9f9f9;
      ">${item}</div>`;
      }
    });

    cardHTML += "\n  </div>\n</div>";

    // Combine original text above marker + card HTML if there are links
    let finalText = beforeMarker;
    if (hasLink) {
      finalText += "\n\n" + cardHTML;
    }

    return finalText;
  }

  // Initialize slider values display
  updateSliderValues();

})();