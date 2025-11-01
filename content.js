(  async () => {
  if (document.getElementById("toneshift-sidebar-host")) return;

  console.log("ToneShift sidebar injected!");

  const rewriteModule = await import(chrome.runtime.getURL('pageHybrid.js'));

  const helperFunctions =  await import(chrome.runtime.getURL('utils/helpers.js'));

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
      background-color: #261a42ff;
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
      background: #2a1b4d;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 16px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(255, 255, 255, 0.88);
      z-index: 1000000;
      display: block;
      font-family: sans-serif;
      font-weight: bold;
      white-space: nowrap;
    }
    .ts-floating-preview-btn:hover {
      background: #2a1b4d;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.86);
    }
    .tsExplainBtn {
      /*position: absloute;*/
      background: #2a1b4d;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 1000000;
      display: block;
      font-family: sans-serif;
      font-weight: bold;
      white-space: nowrap;
    }
    .tsExplainBtn:hover {
      background: #2a1b4d;
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
    /* Preview container - minimal padding, accent border */
    .ts-preview-container {
      position: relative;
      margin: 1em 0;                
      padding: 0;
      border-radius: 6px;
      border-left: 4px solid #7c4dff;  /* accent only on left */
      background: transparent;
      box-shadow: none;
      font-family: inherit;
      color: inherit;

      display: flex;
      flex-direction: column; /* stack meta and highlight vertically */
      gap: 4px;              /* spacing between meta row and highlight */
    }

    /* Meta row container */
    .ts-meta {
      display: flex;
      justify-content: space-between; /* first item left, last item right */
      align-items: center;           /* vertical centering */
      padding: 4px 8px 0 8px;       /* horizontal padding for edges */
      gap: 0;                        /* remove extra gap */
    }

    /* Badge - stays on extreme left */
    .ts-badge {
      display: inline-flex;          /* shrink to content */
      align-items: center;           /* vertical center */
      background: #b388ff;
      color: #121212;
      font-size: 8px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      height: auto;                  /* allow padding to control height */
    }

    /* Revert button - stays on extreme right */
    .ts-revert-button {
      display: inline-flex;          
      align-items: center;           
      background: #1e88e5;
      color: #ffffff;
      border: 1px solid #1565c0;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
      height: auto;                  /* prevent vertical stretching */
    }

    .ts-revert-button:hover {
      background: #1565c0;
      box-shadow: 0 2px 6px rgba(21, 101, 192, 0.4);
      transform: translateY(-1px);
    }

    .ts-revert-button:focus {
      outline: 3px solid rgba(30, 136, 229, 0.4);
      outline-offset: 2px;
    }

    /* Inner quoted content */
    .ts-preview-text-highlight {
      padding: 5px;
      border-radius: 4px;
      line-height: 1.6;
      font-size: 0.95rem;

      width: 100%;                  /* full width inside flex column */
      box-sizing: border-box;       /* include padding in width */
    }

    /* Light mode background */
    @media (prefers-color-scheme: light) {
      .ts-preview-text-highlight {
        background: #f6f2ff;   /* soft lavender tint */
        color: #2a1b4d;        /* dark violet text for readability */
      }
    }

    /* Dark mode background */
    @media (prefers-color-scheme: dark) {
      .ts-preview-text-highlight {
        background: rgba(46, 40, 64, 0.85); 
        color: #f0eaff;
      }
    }

    /* Spinner styling */
  .ts-await-rewrite-spinner {
    position: fixed; /* relative to viewport */
    width: 24px;
    height: 24px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #b388ff;
    border-radius: 70%;
    animation: ts-spin 0.8s linear infinite;
    z-index: 999999;
    display: none;
  }
  /* Keyframes for spin */
  @keyframes ts-spin {
    to { transform: rotate(360deg); }
  }
  `;

  document.head.appendChild(style);

  // --- Floating icon ---
  const floatingIcon = document.createElement("div");
  floatingIcon.id = "ts-floating-icon";
  floatingIcon.textContent = "TS";
  floatingIcon.style.display = "none";
  //document.body.appendChild(floatingIcon);

  // --- Floating preview button ---
  const floatingPreviewBtn = document.createElement("button");
  floatingPreviewBtn.className = "ts-floating-preview-btn";
  floatingPreviewBtn.textContent = "✨ Refine this text";
  floatingPreviewBtn.title = "Polish your selected text instantly with ToneShift.";
  //document.body.appendChild(floatingPreviewBtn);

  const fPBContainer = document.createElement("div")
  fPBContainer.className = "ts-fpb-container"
  fPBContainer.appendChild(floatingPreviewBtn)
  document.body.appendChild(fPBContainer)

  // Floating Lens Action container
  const explainBtn = document.createElement("button")
  explainBtn.className = "tsExplainBtn"
  explainBtn.textContent = "🔍 Help me Explain"
  explainBtn.title = "Get detailed explanation of the selected text."
  //fPBContainer.appendChild(explainBtn)

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
      /* default button style used for action buttons inside the sidebar */
      button {
        margin: 4px 2px;
        padding: 6px 10px;
        border: none;
        background: #b388ff;
        font-weight: 500;
        color: #121212;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover { background: #b388ff; }

      /* compact close button positioned at top-right of the sidebar */
      #ts-hide-sidebar {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 34px;
        height: 34px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: transparent; /* keep subtle */
        color: #6C63FF;
        font-weight: 700;
        font-size: 16px;
        line-height: 1;
      }
      #ts-hide-sidebar:hover {
        background: rgba(108,99,255,0.08);
      }
      input[type=range] { width: 100%; }
      hr { margin: 10px 0; }
      #ts-spinner .ts-loader {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #b388ff;
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
        color: #121212;
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
        border-left: 3px solid #b388ff;
      }
      #ts-advanced-controls label {
        /*font-weight: bold;*/
        color: #121212;
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
      #ts-general-controls {
        font-family: system-ui, sans-serif;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 15px;
        max-width: 300px;
        background-color: #fafafa;
        transition: all 0.3s ease;
      }

      #ts-general-controls h3 {
        margin-top: 0;
        color: #333;
      }

      .toggle-label {
        font-weight: 500;
        color: #333;
        cursor: pointer;
      }

      #ts-gemini-cloud-model-toggle {
        margin-left: 8px;
        transform: scale(1.1);
        cursor: pointer;
      }

      /* The “faded” look when disabled */
      #ts-general-controls.inactive .ts-settings-body {
        opacity: 0.4;
        pointer-events: none;
        filter: grayscale(80%);
      }

      #ts-general-controls.inactive {
        background-color: #f0f0f0;
        border-color: #ddd;
      }

      .input-label {
        display: block;
        margin-top: 15px;
        color: #555;
      }

      #ts-gemini-api-key {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-top: 4px;
        font-size: 14px;
        transition: border-color 0.3s ease;
      }

      #ts-gemini-api-key:focus {
        border-color: #007bff;
        outline: none;
      }

      #ts-set-key {
        margin-top: 10px;
        padding: 7px 10px;
        border: none;
        border-radius: 4px;
        background-color: #007bff;
        color: white;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.3s ease;
      }

      #ts-set-key:hover {
        background-color: #0056b3;
      }

    </style>

    <div id="toneshift-sidebar">
  <h2>✨ToneShift</h2>

  <button id="ts-hide-sidebar" aria-label="Close sidebar">✕</button>
      
      <hr>
      <div class="ts-mode-selection-section" style="display:none">
      <label for="ts-mode-select">Mode:</label>
      <select id="ts-mode-select">
        <!-- Options will be populated dynamically -->
      </select>
      

      <button id="ts-preview" title="Polish your selected text instantly with ToneShift.">Refine</button>
      <button id="ts-apply">Apply</button>
      <button id="ts-undo">Undo</button>
      <button id="ts-reset" title="Remove all applied AI rewritten text from the page.">Reset</button>
      <hr>
      </div>

      <div class="ts-toggle" title="Refine / Explain actions appear near selected text" style="margin-top:8px;">
        <input type="checkbox" id="ts-show-floating" />
        <label for="ts-show-floating" style="font-size:13px; margin-left:6px;">Show action buttons on text highlight</label>
      </div>
      <hr>

      <button id="ts-advanced-toggle">⚙️ Advanced Options</button>
      <div id="ts-advanced-controls" style="display: none;">

        <div class="custom-modes-section" style="display:none">
        <label style="font-weight:600">Custom Modes:</label>
        <select id="ts-profile-select"></select><br><br>
         <hr>

        <label style="font-weight:600">Tone: <span id="ts-tone-value" style="font-weight:300">Neutral</span></label>
        <input id="ts-tone" type="range" min="0" max="10" value="5"><br>

        <label style="font-weight:600">Complexity: <span id="ts-complexity-value" style="font-weight:300">Medium</span></label>
        <input id="ts-complexity" type="range" min="0" max="10" value="5"><br>
        
        <label style="font-weight:600">Brevity: <span id="ts-brevity-value" style="font-weight:300">Medium</span></label>
        <input id="ts-brevity" type="range" min="0" max="10" value="5"><br>

        
        <button id="ts-save-profile">Save Current</button>
        <button id="ts-edit-profile">Edit Selected</button>
        <button id="ts-delete-profile">Delete</button>
         <hr>
        </div>
       
        <div id="ts-general-controls">
          <div><h3>General Settings</h3></div>
          <label for="ts-gemini-cloud-model-toggle" class="toggle-label">
            Use Cloud Gemini Model
          </label>
          <input type="checkbox" id="ts-gemini-cloud-model-toggle">

          <div class="ts-settings-body">
            <input type="password" id="ts-gemini-api-key" placeholder="Enter your Gemini API Key">
            <label for="ts-gemini-api-key" class="input-label">
              🔑 Gemini API Key
            </label>
            
            <button id="ts-set-key">Save Key</button>
          </div>
        </div>

        <hr>

        <div id="ts-refine-controls" style="margin-top:10px;">
          <h3>Refine Text Settings</h3>
          <div class="setting-with-tooltip">
            <input type="checkbox" id="ts-preserve-formatting">
            <label for="ts-preserve-formatting">Maintain page original formatting</label>
            <span class="tooltip" role="tooltip">
              Preserve existing text styling, bold, italics, links, and other HTML formatting.<br>
              <span>Note: When enabled, rewrites can take more time and also more token consumption when
              using a cloud Gemini model.</span>
            </span>
          </div>
          <br><br>
        </div>
        <hr>
      </div>

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
  host.style.display = "none"

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
  const apiKeyInput = qs('ts-gemini-api-key');
  const apiKeySaveBtn = qs('ts-set-key');

  undoBtn.style.display = "none" // hide sidebar undoBtn
  applyBtn.style.display = "none" // hide sidebar applyBtn

  // --- State ---
  let lastAIResponse = "";
  const undoStack = [];
  const rewriteMap = {}
  let placeholderMap = {};
  let mapKeyPool = 0
  let rewriteWithFormat = false
  let latestModeSelect = ""
  let isShowingPanels = false


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
    Simple: { tone: 2, complexity: 2, brevity: 8 },
    "Easy Read": { tone: 6, complexity: 2, brevity: 8 },
    "Casual": { tone: 5, complexity: 5, brevity: 5 },
    "Short": { tone: 2, complexity: 2, brevity: 8 },
    "Formal": { tone: 8, complexity: 9, brevity: 7 },
    "Creative": { tone: 6, complexity: 5, brevity: 6 },
    
  };
  let userProfiles = {};

  let allPresets = {...builtInPresets, ...userProfiles}

  // --- Text Selection and Floating Button Logic - COMPLETELY REWRITTEN ---
  function showFloatingPreviewButton(range, rect) {
    // Centralized preference check: read user preference and only show if enabled
    if (!range || !rect) {
      hideFloatingPreviewButton();
      return;
    }

    try {
      chrome.storage.local.get(['showFloatingOnHighlight'], (data) => {
        const enabled = data && data.showFloatingOnHighlight;
        // Default to true when unset
        if (enabled !== undefined && enabled !== null && enabled === true && !isShowingPanels) {
          // Store both range and rect for later use
          try {
            floatingButtonState.range = range.cloneRange();
          } catch (e) {
            // cloneRange can fail on some exotic ranges; fall back to storing the original
            floatingButtonState.range = range;
          }
          floatingButtonState.rect = rect;

          // Position button near selection - use fixed positioning correctly
          fPBContainer.style.top = (rect.bottom + window.scrollY + 10) + 'px';
          fPBContainer.style.left = (rect.left + window.scrollX) + 'px';
          fPBContainer.style.display = 'grid';
        } else {
          hideFloatingPreviewButton();
        }
      });
    } catch (err) {
      // If storage isn't available for some reason, default to showing the button
      console.error('Error reading showFloatingOnHighlight preference inside showFloatingPreviewButton', err);
      try {
        floatingButtonState.range = range.cloneRange();
      } catch (e) {
        floatingButtonState.range = range;
      }
      floatingButtonState.rect = rect;
      fPBContainer.style.top = (rect.bottom + window.scrollY + 10) + 'px';
      fPBContainer.style.left = (rect.left + window.scrollX) + 'px';
      fPBContainer.style.display = 'grid';
    }

    /*
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
    */

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
    return revertPreviewBtn;
  }

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

  
  explainBtn.addEventListener("click", async (e)=>{
    e.stopPropagation();
    //expandSelectionToWholeWordsAcrossNodes()
    const selection = window.getSelection();
    await chatPanelModule.openChatPanel(selection)
    if(!chatPanelModule.isInputHandlerSet)
      await chatPanelModule.registerInputHandler(explainTextInputHelper)
    hideFloatingPreviewButton();
    
  })

  apiKeySaveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      statusEl.textContent = "⚠️ Please enter a valid API key.";
      return;
    }

    chrome.storage.local.set({ apiKey: key }, () => {
      console.log("Gemini API Key saved.");
      chrome.runtime.sendMessage({ action: 'updateGeminiApiKey', apiKey: key });
      statusEl.textContent = "API Key saved.";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    });
  });

  document.addEventListener('mousedown', (e) => {
    //console.log(document.body.innerText)
    // Only hide if not clicking on the button itself
    if (!isMouseDownOnButton && !fPBContainer.contains(e.target)) {
      hideFloatingPreviewButton();
    }
  });

  document.addEventListener('mouseup', (e) => {
    // Don't process if clicking on ToneShift UI or the floating button
    if (e.target.closest('#toneshift-sidebar-host') || 
        e.target === floatingPreviewBtn ||
        isMouseDownOnButton){return;}

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
  if (selectedText.split(" ").length > 5) {
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
            // Call the centralized show function which checks the preference internally
            showFloatingPreviewButton(range, rect);
          }
        }, 500);
      } else {
        hideFloatingPreviewButton();
      }
    } else {
      hideFloatingPreviewButton();
    }
  });  

  //expand the current selection to the containing sentence (works across inline tags)
  function expandSelectionToSentence({ debug = false } = {}) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const origRange = sel.getRangeAt(0);

    // Find the nearest block ancestor of the selection start
    let block = origRange.startContainer;
    while (block && block.nodeType !== Node.ELEMENT_NODE) block = block.parentNode;
    while (block && !isBlockElement(block)) block = block.parentNode;
    if (!block) {
      if (debug) console.warn('No block ancestor found.');
      return;
    }

    // Get the full block text (this respects inline tags)
    const blockRange = document.createRange();
    blockRange.selectNodeContents(block);
    const fullText = blockRange.toString();

    // Helper: get absolute offset (number of characters from block start) for a boundary
    function absoluteOffsetFor(container, offset, clampToBlock = true) {
      try {
        if (!block.contains(container)) {
          // If selection boundary is outside the block, clamp to start or end
          return clampToBlock ? (container.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING ? 0 : fullText.length) : null;
        }
        const r = document.createRange();
        r.setStart(block, 0);
        r.setEnd(container, offset);
        return r.toString().length;
      } catch (e) {
        if (debug) console.error('absoluteOffsetFor error', e);
        return null;
      }
    }

    // Compute absolute start / end within the block (clamp selection if it spills out)
    let absStart = absoluteOffsetFor(origRange.startContainer, origRange.startOffset);
    let absEnd   = absoluteOffsetFor(origRange.endContainer, origRange.endOffset);
    if (absStart === null) absStart = 0;
    if (absEnd === null)   absEnd   = fullText.length;

    // Safety: ensure valid ordering
    if (absStart < 0) absStart = 0;
    if (absEnd > fullText.length) absEnd = fullText.length;
    if (absStart > absEnd) { const t = absStart; absStart = absEnd; absEnd = t; }

    if (debug) {
      console.group('expandSelectionToSentence debug');
      console.log('block text:', JSON.stringify(fullText));
      console.log('absStart:', absStart, 'absEnd:', absEnd);
    }

    // Sentence boundary search (simple; you can extend this to handle abbreviations)
    const boundaryRE = /[.!?]/;
    // Find previous punctuation (scan left)
    let sentenceStart = 0;
    for (let i = absStart - 1; i >= 0; i--) {
      if (boundaryRE.test(fullText[i])) { sentenceStart = i + 1; break; }
    }
    // Find next punctuation (scan right)
    let sentenceEnd = fullText.length;
    for (let i = absEnd; i < fullText.length; i++) {
      if (boundaryRE.test(fullText[i])) { sentenceEnd = i + 1; break; }
    }

    // Trim surrounding whitespace
    while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) sentenceStart++;
    while (sentenceEnd > 0 && /\s/.test(fullText[sentenceEnd - 1])) sentenceEnd--;

    if (sentenceStart >= sentenceEnd) {
      // nothing meaningful found — expand to the whole block as a fallback
      sentenceStart = 0;
      sentenceEnd = fullText.length;
    }

    if (debug) {
      console.log('sentenceStart:', sentenceStart, 'sentenceEnd:', sentenceEnd,
                  'excerpt:', JSON.stringify(fullText.slice(sentenceStart, sentenceEnd)));
    }

    // Map absolute offsets back to (textNode, offset) pairs
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    if (textNodes.length === 0) {
      if (debug) console.warn('No text nodes under block.');
      return;
    }

    // Find start node/offset and end node/offset by scanning cumulative lengths
    let cum = 0;
    let startNode = null, startNodeOffset = 0;
    let endNode = null, endNodeOffset = 0;
    for (let i = 0; i < textNodes.length; i++) {
      const tn = textNodes[i];
      const nextCum = cum + tn.textContent.length;

      if (startNode === null && sentenceStart <= nextCum) {
        startNode = tn;
        startNodeOffset = Math.max(0, sentenceStart - cum);
      }

      if (endNode === null && sentenceEnd <= nextCum) {
        endNode = tn;
        endNodeOffset = Math.max(0, sentenceEnd - cum);
      }

      cum = nextCum;
    }

    // If end wasn't found, it's at the end of the last text node
    if (!endNode) {
      endNode = textNodes[textNodes.length - 1];
      endNodeOffset = endNode.textContent.length;
    }
    // If start wasn't found (odd), fallback to first node start
    if (!startNode) {
      startNode = textNodes[0];
      startNodeOffset = 0;
    }

    if (debug) {
      console.log('startNode text snippet:', JSON.stringify(startNode.textContent.slice(0, 60)));
      console.log('startNodeOffset:', startNodeOffset, 'endNodeOffset:', endNodeOffset);
      console.groupEnd();
    }

    // Create and apply the new range
    const newRange = document.createRange();
    try {
      newRange.setStart(startNode, startNodeOffset);
      newRange.setEnd(endNode, endNodeOffset);

      sel.removeAllRanges();
      sel.addRange(newRange);
    } catch (e) {
      if (debug) console.error('Error building new range', e);
    }

    // --- helpers ---
    function isBlockElement(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
      const display = window.getComputedStyle(el).display;
      return display === 'block' || display === 'list-item' || display === 'table' || display === 'flex' || display === 'grid';
    }
  }

  // Expands selection to full words, but only across blocks if the user selection spans them
  function expandSelectionToWholeWordsAcrossNodes({ debug = false } = {}) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const origRange = sel.getRangeAt(0);

    // Get start and end elements
    const startEl = origRange.startContainer.nodeType === Node.ELEMENT_NODE
      ? origRange.startContainer
      : origRange.startContainer.parentElement;
    const endEl = origRange.endContainer.nodeType === Node.ELEMENT_NODE
      ? origRange.endContainer
      : origRange.endContainer.parentElement;

    // Find the common ancestor (usually a container like <div> or <body>)
    let ancestor = origRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? origRange.commonAncestorContainer
      : origRange.commonAncestorContainer.parentNode;

    // If the selection is fully inside one element, confine to that element
    // Otherwise, allow expansion across blocks
    if (startEl && endEl && startEl === endEl) {
      ancestor = startEl;
    }

    // Flatten text within the chosen ancestor
    const fullRange = document.createRange();
    fullRange.selectNodeContents(ancestor);
    const fullText = fullRange.toString();

    // Compute absolute offsets relative to ancestor
    function absoluteOffset(container, offset) {
      try {
        const r = document.createRange();
        r.setStart(ancestor, 0);
        r.setEnd(container, offset);
        return r.toString().length;
      } catch {
        return null;
      }
    }

    let absStart = absoluteOffset(origRange.startContainer, origRange.startOffset);
    let absEnd = absoluteOffset(origRange.endContainer, origRange.endOffset);

    if (absStart === null) absStart = 0;
    if (absEnd === null) absEnd = fullText.length;
    if (absStart > absEnd) [absStart, absEnd] = [absEnd, absStart];

    // Expand to word boundaries
    while (absStart > 0 && /\w/.test(fullText[absStart - 1])) absStart--;
    while (absEnd < fullText.length && /\w/.test(fullText[absEnd])) absEnd++;

    // Map absolute offsets back to nodes
    const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let cum = 0;
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;

    for (const tn of textNodes) {
      const nextCum = cum + tn.textContent.length;

      if (!startNode && absStart <= nextCum) {
        startNode = tn;
        startOffset = absStart - cum;
      }
      if (!endNode && absEnd <= nextCum) {
        endNode = tn;
        endOffset = absEnd - cum;
      }

      cum = nextCum;
    }

    if (!startNode) {
      startNode = textNodes[0];
      startOffset = 0;
    }
    if (!endNode) {
      endNode = textNodes[textNodes.length - 1];
      endOffset = endNode.textContent.length;
    }

    const newRange = document.createRange();
    newRange.setStart(startNode, startOffset);
    newRange.setEnd(endNode, endOffset);

    sel.removeAllRanges();
    sel.addRange(newRange);

    if (debug) {
      console.group('expandSelectionToWholeWordsAcrossNodes');
      console.log('Ancestor:', ancestor);
      console.log('Expanded selection:', JSON.stringify(fullText.slice(absStart, absEnd)));
      console.groupEnd();
    }
  }

  // expand the selection to a whole paragraph
  function expandSelectionToParagraph() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    // climb up the DOM until we hit a <p> element
    while (node && node.nodeName.toLowerCase() !== "p") {
      node = node.parentNode;
    }

    if (node && node.nodeName.toLowerCase() === "p") {
      const newRange = document.createRange();
      newRange.selectNodeContents(node);

      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  function getSelectionParentParagraph() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    let node = selection.anchorNode;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'P') {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function getSelectionParentContainer() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    let node = selection.anchorNode;

    // If the selection is within a text node, move up to its element parent
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    // Walk up until we find a meaningful container
    while (node) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        ['P', 'LI', 'DIV', 'TD', 'SECTION', 'ARTICLE'].includes(node.tagName)
      ) {
        return node;
      }
      node = node.parentNode;
    }

    // Fallback: return the actual text if no container found
    return null;
  }



  // Floating button click handler - FIXED: Use stored state
  floatingPreviewBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    if (floatingButtonState.range) {
      hideFloatingPreviewButton();
      initiateRewrite()
    } else {
      console.error("No preview range available");
    }
  });

  const SAFE_INPUT_LIMIT = 300
  function estimateToken(e){
    return(Math.ceil(e/4))
  }
  async function initiateRewrite(){
    // Create a selection from the stored range
    //expandSelectionToWholeWordsAcrossNodes()
    const parentContainer = getSelectionParentContainer()
    //expandSelectionToParagraph() // expand the selection to a whole paragraph
    const selection = window.getSelection();
    if (!selection) return

    const selectedText = selection.toString().trim()
    if(estimateToken(selectedText.length) > SAFE_INPUT_LIMIT){
      alert("Cannot refine the selected text.\nSelected text is too long.\nFor best experience keep selected texts short.")
      hideFloatingPreviewButton()
      return
    }
    console.log(estimateToken(selectedText.length))
    //selection.removeAllRanges();
    //selection.addRange(floatingButtonState.range.cloneRange());
    const range = selection.getRangeAt(0).cloneRange();
    const originalContent = range.cloneContents();
    const mapKey = getMapKey();
    rewriteMap[mapKey] = {range:range, originalContent:originalContent, parentContainer:parentContainer};
    
    //console.log(rewriteMap)
    
    isPreviewMode = true

    // Ensure microcard is created and populated before sending the preview request
    // Awaiting showMicroCard avoids a race where the AI response arrives before
    // the microcard DOM exists (which previously caused document.querySelector to return null).
    setTimeout(async () => {
      await showMicroCard(selection, mapKey);
    }, 20);
    

    // Use the same preview logic (now that the microcard exists)
    await performPreview(mapKey);
  }


  // ================ Storage Initialization ================== 
   chrome.storage.local.get("tsLastMode", (data) => {
      if(!data.tsLastMode) chrome.storage.local.set({ tsLastMode:"Simple"})
        currentMode = data.tsLastMode
    })
    chrome.storage.local.get("showFloatingOnHighlight", (data) => {
      if(data.showFloatingOnHighlight === null || data.showFloatingOnHighlight === undefined)
        chrome.storage.local.set({ showFloatingOnHighlight:true })
    })

    

    

  // --- Common Preview Function ---
  async function performPreview(rewriteMapKey) {
    const selection = rewriteMap[rewriteMapKey].range

    const selectionText = selection.toString().trim();
    if (!selectionText) {
      outputBox.textContent = "No text selected.";
      return;
    }

    // Reset globals
    placeholderIndex = 0;
    placeholderMap = {};

    // Build text with placeholders
    const textWithPlaceholders = replaceNodes(selection);

    const settings = {
      tone: mapTone(toneSlider.value),
      complexity: mapComplexity(complexitySlider.value),
      brevity: mapBrevity(brevitySlider.value),
    };

    const _context = "" 
    const {rewriteWithFormat} = await chrome.storage.local.get("rewriteWithFormat")
    // Send to AI

    const eventData = {
        type: "TS_GEMINI_REQUEST",
        textWithPlaceholders: textWithPlaceholders.trim(),
        textWithoutPlaceholders: selectionText,
        rewriteWithFormat:rewriteWithFormat,
        context:_context,
        ...settings,
        mode:currentMode
      }
    /*window.postMessage(
      eventData,
      "*"
    );*/

    const result = await rewriteModule.performRewrite(eventData)
    const rewrittenText = result.reply || "Something went wrong."
    updateOutputDisplayUI(rewrittenText, result)
  }

  // --- Profile Loading - FIXED: Properly include user profiles ---
  async function loadProfiles() {
    const data = await chrome.storage.local.get("profiles");
    userProfiles = data.profiles || {};
    allPresets = {...builtInPresets, ...userProfiles}
    
    // Clear and rebuild both dropdowns
    customModeSelect.innerHTML = "";
    modeSelect.innerHTML = "";

    // Add built-in presets to both dropdowns
    Object.keys(builtInPresets).forEach(name => {
      // Add to custom mode dropdown
      /*
      const profileOption = document.createElement("option");
      profileOption.value = name;
      customModeSelect.appendChild(profileOption);
      */
      
      // Add to mode dropdown
      const modeOption = document.createElement("option");
      modeOption.id = "ts-mode-option"
      modeOption.value = name;
      modeOption.textContent = name;
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
    try{
      toneSlider.value = profile.tone;
      complexitySlider.value = profile.complexity;
      brevitySlider.value = profile.brevity;
      updateSliderValues();
    }catch(e){}
  }
  
  function updateSliderValues() {
    toneValue.textContent = mapTone(toneSlider.value);
    complexityValue.textContent = mapComplexity(complexitySlider.value);
    brevityValue.textContent = mapBrevity(brevitySlider.value);
  }

  // Initialize with default profile
  loadProfiles().then(() => {
    applyProfile(builtInPresets["Simple"]);
  });

  // --- Mode Select Event Listener ---
  modeSelect.addEventListener("change", (e) => {
    e.stopPropagation()
    const modeName = modeSelect.value;
    currentMode = modeName;
    console.log("Mode changed to:", currentMode);
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
  // Robust applyInlinePreview with correct mapping of selection to cloned paragraph
  function applyInlinePreview(rewrittenText, rewriteMapKey) {
    if (!rewriteMapKey) {
      console.error("No rewriteMapKey provided for inline preview.");
      return;
    }

    try {
      hideFloatingPreviewButton();

      const mapEntry = rewriteMap[rewriteMapKey];
      if (!mapEntry) {
        console.error("No entry in rewriteMap for key:", rewriteMapKey);
        return;
      }

      const { range, originalNodes, parentContainer } = mapEntry;
      if (!range || !parentContainer) {
        console.error("Missing range or parentContainer in rewriteMap entry.");
        return;
      }

      // --- Compute character offsets robustly (works even with nested nodes) ---
      function getOffsetsWithinContainer(rng, container) {
        const preRange = document.createRange();
        preRange.setStart(container, 0);
        preRange.setEnd(rng.startContainer, rng.startOffset);
        const start = preRange.toString().length;

        const postRange = document.createRange();
        postRange.setStart(container, 0);
        postRange.setEnd(rng.endContainer, rng.endOffset);
        const end = postRange.toString().length;

        return { start, end };
      }

      const { start: selStart, end: selEnd } = getOffsetsWithinContainer(range, parentContainer);

      // --- Clone original container ---
      const originalClone = parentContainer.cloneNode(true);
      mapEntry.originalClone = originalClone;

      const previewContainer = parentContainer.cloneNode(true);

      // --- Create highlight range within the clone ---
      function createRangeFromOffsets(container, startOffset, endOffset) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node, lastNode = null;
        let charCount = 0;
        const newRange = document.createRange();
        let foundStart = false;

        while ((node = walker.nextNode())) {
          const len = node.textContent.length;
          lastNode = node;

          if (!foundStart && charCount + len >= startOffset) {
            newRange.setStart(node, startOffset - charCount);
            foundStart = true;
          }
          if (foundStart && charCount + len >= endOffset) {
            newRange.setEnd(node, endOffset - charCount);
            return newRange;
          }

          charCount += len;
        }

        // --- Handle edge cases ---
        if (foundStart) {
          // If we started but didn't find an end, use the last node we saw
          if (lastNode) {
            newRange.setEnd(lastNode, lastNode.textContent.length);
            return newRange;
          }
        } else if (lastNode) {
          // Selection may start at the very end of container
          newRange.setStart(lastNode, lastNode.textContent.length);
          newRange.setEnd(lastNode, lastNode.textContent.length);
          return newRange;
        }

        console.warn("Could not map offsets within container; returning null range.");
        return null;
      }


      const cloneRange = createRangeFromOffsets(previewContainer, selStart, selEnd);

      if (cloneRange) {
        const highlightSpan = document.createElement("span");
        highlightSpan.className = "ts-preview-text-highlight";
        highlightSpan.textContent = rewrittenText;
        cloneRange.deleteContents();
        cloneRange.insertNode(highlightSpan);
      } else {
        const fallbackSpan = document.createElement("span");
        fallbackSpan.className = "ts-preview-text-highlight";
        fallbackSpan.textContent = rewrittenText;
        previewContainer.appendChild(fallbackSpan);
      }

      // --- Build meta row + revert logic ---
      const metaRow = document.createElement("div");
      metaRow.className = "ts-meta";

      const badge = document.createElement("span");
      badge.className = "ts-badge";
      badge.textContent = "AI Refined text";

      const revertButton = createRevertPreviewBtn();
      revertButton.textContent = "Back to original text";
      revertButton.classList.add("ts-revert-button");

      metaRow.appendChild(badge);
      metaRow.appendChild(revertButton);

      const wrapper = document.createElement("aside");
      wrapper.className = "ts-preview-container";
      wrapper.setAttribute("role", "region");
      wrapper.appendChild(metaRow);
      wrapper.appendChild(previewContainer);

      undoStack.push({ range, originalNodes, parentContainer });
      parentContainer.replaceWith(wrapper);
      currentPreviewElement = wrapper;
      isPreviewMode = true;

      revertButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const container = e.target.closest(".ts-preview-container");
        const entry = rewriteMap[rewriteMapKey];
        const cloneForRestore = entry && entry.originalClone;

        if (container && cloneForRestore) {
          container.replaceWith(cloneForRestore);
          delete rewriteMap[rewriteMapKey];
          isPreviewMode = false;
        } else {
          console.error("Missing restore target.");
        }
      });

      console.log("Inline preview applied (works with any container).");
      return rewriteMapKey;

    } catch (error) {
      console.error("Error applying inline preview:", error);
    }
  }

  function revertInlinePreview(mapKey, removeEntry=false) {
    const { parentContainer } = rewriteMap[mapKey];
    const previewContainer = e.target.closest(".ts-preview-container");

    if (!previewContainer || !parentContainer) {
      console.error("Missing preview container or original paragraph for revert.");
      return;
    }

    // Replace the entire preview container with the original paragraph
    previewContainer.replaceWith(parentContainer);

    // Cleanup state
    if(removeEntry){
      delete rewriteMap[mapKey];
      previewRange = null;
      previewOriginalContent = null;
      isPreviewMode = false;
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


  let modelPreferenceChangeCallbacks = []
  // --- Listen for background message ---
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "toggleSidebar") {
      return
      if (msg.visible) {
        sidebar.style.display = "block";
        floatingIcon.style.display = "none";
      } else {
        sidebar.style.display = "none";
        floatingIcon.style.display = "flex";
      }
      chrome.storage.local.set({ sidebarVisible: msg.visible });
    }
    if (msg.action == "helpMeExplain"){
      //console.log("got helpmeexplain message from backgroun")
      await chatPanelModule.openChatPanel(null)
      if(!chatPanelModule.isInputHandlerSet)
        await chatPanelModule.registerInputHandler(explainTextInputHelper)
    }

    if (msg.action == "refineText"){
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
    
      if(selectedText.split(" ").length <  5) {alert("No selected texts or texts length too short.\nSelect 5 or more words to refine"); return}
      initiateRewrite()
      hideFloatingPreviewButton()
    }
  });

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

  // ===================== Create Floating "Refine" Microcard =================================
  // == global variable used among functions
  let originalText = ""
  let refineMicroCard = null
  let microcardRewrittenEl = document.createElement("div")
  let _rewriteMapKey = null
  let startRewrite  = () => {}

  async function createModePresetCard(originalTextOrSelection, rewriteMapKey) {
    originalText = "This is a sample text to refine.";
    let rect = null;

    if (!rewriteMapKey) {
      console.error("No rewriteMapKey provided to createModePresetCard");
      return;
    }
    _rewriteMapKey = rewriteMapKey

    // Handle selection input or string
    if (originalTextOrSelection && originalTextOrSelection.toString) {
      const selection = originalTextOrSelection;
      originalText = selection.toString().trim() || originalText;
      if (selection.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
      }
    } else if (typeof originalTextOrSelection === "string") {
      originalText = originalTextOrSelection;
    }

    // === Create the Shadow DOM host and attach shadow root ===
    const host = document.createElement("div");
    host.className = "tsMicrocard-host";
    host.style.display = "absolute"
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    // === Inject the styles into the shadow root ===
    const styleEl = document.createElement("style");
    styleEl.textContent = floatingRefinePopupStyle.textContent;
    shadow.appendChild(styleEl);

    // === Create the inner card inside the shadow root ===
    const microcard = document.createElement("div");
    microcard.className = "tsMicrocard sidebar";
    shadow.appendChild(microcard);

    refineMicroCard = microcard; // Store global reference

    // === Header ===
    const header = document.createElement("div");
    header.className = "tsMicrocardHeader";
    setOwnText(header, "ToneShift - Refine text");
    microcard.appendChild(header);

    // === Hover tracking ===
    let isMouseOverCard = false;
    const onEnter = () => (isMouseOverCard = true);
    const onLeave = () => (isMouseOverCard = false);
    host.addEventListener("mouseenter", onEnter);
    host.addEventListener("mouseleave", onLeave);

    //host.addEventListener("mouseenter", () => (isMouseOverCard = true));
    //host.addEventListener("mouseleave", () => (isMouseOverCard = false));

    // === Fade-out and cleanup ===
    function gracefullyRemoveCard() {
      if (!host.isConnected) return;
      host.style.transition = "opacity 0.3s ease";
      host.style.opacity = "0";
      setTimeout(() => {
        if (host.isConnected) host.remove();
        cleanupListeners();
      }, 300);
      isShowingPanels = false;
    }

    const anchorY = rect ? rect.top + window.scrollY : window.innerHeight * 0.4;

    function handleScroll() {
      const currentY = window.scrollY;
      if (Math.abs(currentY - anchorY) > 50 && !isMouseOverCard) {
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("selectionchange", handleSelection);
        gracefullyRemoveCard();
      }
    }

    function handleMouseLeave() {
      return
      if (Math.abs(window.scrollY - anchorY) > 200) {
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("selectionchange", handleSelection);
        gracefullyRemoveCard();
      }
    }

    function handleSelection(event) {
      return;
    }

    function handleClickOutside(event) {
      // Clicks inside the shadow root shouldn't trigger removal
      if (shadow.contains(event.composedPath()[0])) return;
      cleanupListeners();
      gracefullyRemoveCard();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll);
    document.addEventListener("selectionchange", handleSelection);
    host.addEventListener("mouseleave", handleMouseLeave);

    function cleanupListeners() {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("selectionchange", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
      host.removeEventListener("mouseenter", onEnter);
      host.removeEventListener("mouseleave", onLeave);
      host.removeEventListener("mouseleave", handleMouseLeave);
    }

    isShowingPanels = true;
    // === Card positioning ===
    helperFunctions.positionPanel(originalTextOrSelection, host, {width:microcard.offsetWidth, height:microcard.offsetHeight});

    return microcard; // Return the actual inner card for later DOM work
  }
  function getActiveMicrocard() {
    const host = document.querySelector(".tsMicrocard-host");
    return host?.shadowRoot?.querySelector(".tsMicrocard") || refineMicroCard;
  }



  async function buildModeSelectionCard(card, rewriteMapKey) {
    const chipContainer = document.createElement("div");
    chipContainer.className = "tsChipContainer";

    const modes = Object.keys(allPresets)
    //const lastUsed = localStorage.getItem("tsLastMode");
    const { tsLastMode: lastUsed } = await chrome.storage.local.get("tsLastMode");
    modes.forEach((mode) => {
      const chip = document.createElement("button");
      chip.className = "tsChip";
      chip.textContent = mode;
      if (mode === lastUsed) chip.classList.add("tsActive");
      chip.onclick = () => handleModeClick(mode, chip, card, rewriteMapKey);
      chipContainer.appendChild(chip);
    });

    const chip = document.createElement("button");
    chip.className = "tsChip";
    chip.textContent = "x";
    chip.style.color = "#817a7aff"
    chip.title = "Hide AdjustButtons"
    chip.onclick = (() => {
      chipContainer.style.display = "none";
      const micro = getActiveMicrocard();
      const btn = micro.querySelector("#tsChangeModeButton");
      btn.style.display = "block"
    })
    chipContainer.appendChild(chip)
    return chipContainer
  }
  
  // === Handle Mode Selection === //
  async function handleModeClick(mode, chip, card, rewriteMapKey) {
    //localStorage.setItem("tsLastMode", mode);
    await chrome.storage.local.set({ tsLastMode: mode });
    const profile = allPresets[mode];
    currentMode = mode;
    applyProfile(profile);

    //const spinner = card.querySelector(".tsSpinner");
    //spinner.style.display = "block";
    //console.log("rewrimapkey: ", rewriteMapKey, " mode: ", mode)
    //const blurBackground= document.createElement("div")
    //blurBackground.id = "tsSpinnerContainer"
    //microcardRewrittenEl.appendChild(blurBackground);
    //showSpinner(microcardRewrittenEl, "")
    startRewrite()
    await showSpinnerOnRewrittenText(mode)
    
    /*
    microcardRewrittenEl.text = ""
    

    performPreview(rewriteMapKey)
    
    const node = card.querySelector(".tsOriginalText")
    showSpinner(node, mode)
    
    const allChips = card.querySelectorAll(".tsChip");
    allChips.forEach((c) => {
      c.classList.remove("tsActive")
      c.disabled = true
    });
    chip.classList.add("tsActive");

    const replaceBtn = card.querySelector("#tsReplaceButton")
    replaceBtn.disabled=true

    card.querySelector(".tsTextActions").style.display = "none"
    */
   const allChips = card.querySelectorAll(".tsChip");
    allChips.forEach((c) => {
      c.classList.remove("tsActive")
      c.disabled = true
    });
    chip.classList.add("tsActive");

    // #microcard testing
    /*
    setTimeout(() => {
     updateOutputDisplayUI("we are windows")
      
    }, 2000);
    
    return
    */
  }


  // === Show Spinner (Skip Mode Selection Path) === //
  async function showSpinnerOnRewrittenText(mode=null){
    if(!mode) {
      const data  = await chrome.storage.local.get("tsLastMode")
      mode = data.tsLastMode
    }
    const el = getActiveMicrocard()?.querySelector(".tsRewrittenBlock")
    showSpinner(el, mode)
    return
  }

  async function removeSpinnerFromRewrittenText() {
    const el = getActiveMicrocard()?.querySelector("#tsSpinnerContainer")
    if(!el){
      setTimeout(() => {
         removeSpinnerFromRewrittenText()
      }, 80);
      return
    }
    el.remove()
  }


  function showSpinner(node, mode) {
    const spinnerContainer = document.createElement("div")
    spinnerContainer.id = "tsSpinnerContainer"

    const spinner = document.createElement("div");
    spinner.className = "tsSpinner";
    spinner.style.display = "block"

    const getSpinnerText = {
      Simple: "Simplifying text…",
      "Easy Read": "Making it easier to read…",
      Formal: "Formalizing text…",
      Creative: "Rewriting creatively…",
      Short: "Condensing text…",
      Casual: "Rewriting casually..."
    }[mode] || "Adjusting text…";

    const spinnerText = document.createElement("div")
    spinnerText.id = "tsSpinnerText"
    spinner.style.color = "#ffffffff"
    spinnerText.textContent = getSpinnerText
    spinnerContainer.appendChild(spinnerText)
    spinnerContainer.appendChild(spinner)
    node.appendChild(spinnerContainer);
    return
  }

  // === Build Output Display (Original + Rewritten + Actions) === //
  async function buildOutputDisplayUI(originalText, rewriteMapKey, microcard) {
    const card = microcard;
    //console.log(card)
    //card.innerHTML = "";
    let m = card.querySelector(".tsOutputContainer")
    if(m) m.remove()

    const { tsLastMode: lastUsed } = await chrome.storage.local.get("tsLastMode");
    const mode = lastUsed


    const outputContainer = document.createElement("div");
    outputContainer.className = "tsOutputContainer";

    const originalEl = document.createElement("div");
    originalEl.className = "tsOriginalText";
    originalEl.textContent = originalText;
    originalEl.onclick = () => {
      originalEl.classList.toggle("expanded");
    };
    microcardOriginalEl = originalEl;

    const rewrittenEl = document.createElement("div");
    rewrittenEl.className = "tsRewrittenText";
    const metallicShader = document.createElement("div")
    metallicShader.className = "metallic-shader"
    rewrittenEl.appendChild(metallicShader)
    microcardRewrittenEl = rewrittenEl
    
    // Action buttons (copy, adjust tone)
    const textActionButton = document.createElement("div");
    textActionButton.className = "tsTextActions";
    
    const copyIconButton = document.createElement("button");
    copyIconButton.className = "tsIconButton";
    copyIconButton.title = "Copy rewritten text";
    copyIconButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" class="feather feather-copy">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>`;

    // Add event listener for copying
    copyIconButton.addEventListener("click", () => {
      const text = rewrittenEl.textContent.trim();
      if (!text.length) return;

      navigator.clipboard.writeText(text)
        .then(() => {
          // Visual feedback
          copyIconButton.classList.add("copied");
          copyIconButton.textContent = "Copied!";

          // Revert to copy icon after delay
          setTimeout(() => {
            copyIconButton.classList.remove("copied");
            copyIconButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
              class="feather feather-copy">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>`;
          }, 1200);
        })
        .catch(err => {
          console.error("Copy failed:", err);
          alert("Could not copy text.");
        });
    });


    const adjustToneButton  = document.createElement("button");
    adjustToneButton.className = "tsIconButton"; 
    adjustToneButton.id = "tsChangeModeButton"
    adjustToneButton.title = "Adjust tone/style";
    adjustToneButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sliders"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="10"></line><line x1="20" y1="6" x2="20" y2="3"></line></svg>`;
    adjustToneButton.onclick = () => {
      const modeCard = card.querySelector(".tsChipContainer")
      modeCard.style.display = "flex"
      const micro = getActiveMicrocard();
      const self = micro.querySelector("#tsChangeModeButton");
      self.style.display = "none"
    };

    textActionButton.appendChild(copyIconButton);
    textActionButton.appendChild(adjustToneButton);

    const caption = document.createElement("div");
    caption.className = "tsCaption"
    caption.textContent = mode
    caption.textContent = `✨ ${mode} AI refined text`


    const aiBadge = document.createElement("div")
    aiBadge.className = "tsAIBadgeLabel"
    const isCloudAI =  await chrome.storage.local.get("useCloudModel");
    if(isCloudAI.useCloudModel){
      aiBadge.textContent = `Using Cloud AI`
    } else{
      aiBadge.textContent = `Using Local AI`
    }

    const actionBar = document.createElement("div");
    actionBar.className = "tsActionBar";

    const btnReplace = createActionButton("Replace", () =>{
      applyInlinePreview(rewrittenEl.textContent, rewriteMapKey)
      easeOutMicroCard()
    });
    btnReplace.textContent = "Apply Rewrite";

    const btnUndo = createActionButton("Undo", () =>{
      if(typeof rewriteMapKey !== "string") return
      revertInlinePreview(rewriteMapKey)
    });

    btnUndo.style.display="none" // hide the undo button. we don't need it since the microcard fades-out on replace with rewritten text
    undoReplaceButton = btnUndo

    const btnChange = createActionButton("Change Mode", () =>{
      const modeCard = card.querySelector(".tsChipContainer")
      modeCard.style.display = "flex"
      const micro = getActiveMicrocard();
      const self = micro.querySelector("#tsChangeModeButton");
      self.style.display = "none"
    });
    btnChange.textContent = "Adjust Tone/Style";
    
    startRewrite = () => {
      if(!microcardRewrittenEl.querySelector(".metallic-shader")){
        microcardRewrittenEl.textContent = ""
        const metallicShader = document.createElement("div")
        metallicShader.className = "metallic-shader"
        microcardRewrittenEl.appendChild(metallicShader)
      }
      
      performPreview(rewriteMapKey)
      
      const node = card.querySelector(".tsOriginalText")

      const replaceBtn = card.querySelector("#tsReplaceButton")
      replaceBtn.disabled=true

      //microcard.querySelector(".tsTextActions").style.display = "none"
    }

    const modeSelectionCard = await buildModeSelectionCard(refineMicroCard, rewriteMapKey)
    actionBar.append(modeSelectionCard, btnReplace);

    // Create close ("X") button positioned at the top-right
    const header = card.querySelector(".tsMicrocardHeader")
    const btnClose = document.createElement('button');
    btnClose.className = 'tsCloseButton';
    btnClose.textContent = '×';
    btnClose.title = "Close"
    btnClose.onclick = () => {
      card.style.transition = 'opacity 0.3s ease';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
      isShowingPanels = false
    };
    // Append to card
    card.prepend(btnClose);

    showSpinnerOnRewrittenText()
    
    const tsTextFlexContainer = document.createElement("div");
    tsTextFlexContainer.className = "tsTextFlexContainer";

    const leftContainer = document.createElement("div");
    leftContainer.className = "tsLeftContainer";
    
    const leftLabel = document.createElement("div");
    leftLabel.className = "tsTextLabel";
    leftLabel.textContent = "Original";
    leftContainer.appendChild(leftLabel);
    leftContainer.appendChild(originalEl);

    const rewrittenBlock = document.createElement("div");
    rewrittenBlock.className = "tsRewrittenBlock";

    const rightLabel = document.createElement("div");
    rightLabel.className = "tsTextLabel";
    rightLabel.textContent = "🧠 AI Rewrite" //+ (mode || "");
    rewrittenBlock.appendChild(caption);
    rewrittenBlock.appendChild(rewrittenEl);
    rewrittenBlock.appendChild(textActionButton);

    tsTextFlexContainer.appendChild(leftContainer);
    tsTextFlexContainer.appendChild(rewrittenBlock);

    outputContainer.append(tsTextFlexContainer, aiBadge, actionBar);
    card.appendChild(outputContainer);
  }

  function easeOutMicroCard(){
      refineMicroCard.style.transition = 'opacity 0.3s ease';
      refineMicroCard.style.opacity = '0';
      setTimeout(() => {
        refineMicroCard.remove()
      }, 300);
  }

  // === Action Handlers === //
  function createActionButton(label, handler) {
    const btn = document.createElement("button");
    btn.className = "tsActionButton";
    btn.id = "ts"+ label.replaceAll(" ", "") + "Button"
    btn.textContent = label;
    btn.onclick = handler;
    return btn;
  }
  // === Inject Styles === //
  const floatingRefinePopupStyle = document.createElement("style");
   floatingRefinePopupStyle.textContent = `
    /* === CONTAINER CARD === */
    .tsMicrocard {
      position: absolute;
      background: #F8F9FA;
      color: #222;
      border: 1px solid #D0D0D0;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      width: 700px;
      max-width: calc(100vw - 32px); /* prevent overflowing horizontally */
      z-index: 1000;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      transition: opacity 0.25s ease, transform 0.25s ease, top 0.2s ease, left 0.2s ease;
      transform: translateY(8px);
      opacity: 0;
      animation: tsFadeUp 0.25s ease forwards;
      overflow-wrap: break-word;
      height: 400px; /* ADDED: Fixed height */
      display: flex; /* ADDED: Flex container */
      flex-direction: column; /* ADDED: Vertical layout */
    }

    @keyframes tsFadeUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-color-scheme: dark) {
      .tsMicrocard {
        background: #313131ff;
        color: #EAEAEA;
        border: 1px solid #3A3A3A;
      }
    }

    /* ==== Header ==== */
    .tsMicrocardHeader { 
        border-radius: 12px;
        display: "block";
        padding: 12px 14px; 
        font-weight: 700; 
        font-size: 15px;
        color: #1E1E1E;
        background: linear-gradient(90deg, rgba(108,99,255,0.06), transparent);
        border-bottom: 1px solid rgba(108,99,255,0.06);
        flex-shrink: 0; /* ADDED: Prevent header from shrinking */
    }
    @media (prefers-color-scheme: dark) {
      .tsMicrocardHeader {
        background: #1E1E1E;
        color: #EAEAEA;
        border: 1px solid #3A3A3A;
      }
    }

    /* === CLOSE BUTTON === */
    .tsCloseButton {
      position: absolute;
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #777;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s ease, transform 0.3s ease;
    }

    .tsCloseButton:hover {
      color: #6C63FF;
      transform: rotate(90deg) scale(1.1);
    }

    /* === CHIP SECTION === */
    .tsChipContainer {
      display: none;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .tsChip {
      background: #E9ECEF;
      color: #333;
      border: 1px solid #D0D0D0;
      padding: 5px 12px;
      border-radius: 18px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s ease, transform 0.1s ease;
    }

    .tsChip:hover {
      background: #E0E0FF;
      transform: scale(1.03);
    }

    .tsChip.tsActive {
      background: #6C63FF;
      color: #fff;
      border-color: transparent;
      box-shadow: 0 0 4px rgba(108,99,255,0.4);
    }
    .tsChip:disabled {
      cursor: not-allowed;
    }
    .tsChip:disabled:hover {
      background: #AAA;
      transform: none;  
    }

    /* === TEXT CONTAINERS === */
    .tsOutputContainer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1; /* ADDED: Take available space */
      min-height: 0; /* ADDED: Crucial for flex scrolling */
      overflow: hidden; /* ADDED: Prevent container scrolling */
    }

    /* ADDED: Container for left side with proper flex setup */
    .tsLeftContainer {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    /* ADDED: Text label should not shrink */
    .tsTextLabel {
      flex-shrink: 0;
    }

    /* ORIGINAL TEXT — contextual reference */
    .tsOriginalText {
      background: #E9ECEF;
      border-radius: 8px;
      border-left: 3px solid #6C63FF;
      padding: 10px 12px;
      font-style: italic;
      color: #555;
      opacity: 0.85;
      /* REMOVED: height: 50px; */
      /* REMOVED: max-height: 6.5em; */
      overflow-y: auto; /* CHANGED: Enable vertical scrolling */
      overflow-x: hidden; /* ADDED: Disable horizontal scrolling */
      position: relative;
      flex: 1; /* ADDED: Take available space */
      min-height: 0; /* ADDED: Allow shrinking in flex container */
    }

    @media (prefers-color-scheme: dark) {
      .tsOriginalText {
        background: #2A2A2A;
        color: #BBB;
      }
    }

    /* REMOVED: Show more/less functionality since we have scrolling */
    .tsOriginalText::after {
      display: none;
    }

    .tsOriginalText.expanded {
      max-height: none;
      cursor: zoom-out;
    }

    .tsOriginalText.expanded::after {
      content: "Show less";
      max-height: none;
    }

    .tsRewrittenBlock {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      position: relative;
      width: 100%;
      boxsizing: border-box;
      flex: 1; /* ADDED: Take available space */
      min-height: 0; /* ADDED: Allow shrinking in flex container */
    }

    /* REWRITTEN TEXT — focus content */
    .tsRewrittenText {
      position: relative; /* enable absolute positioning inside */
      background: #E6E0FF;
      border-radius: 8px;
      border-left: 3px solid #6C63FF;
      padding: 6px 14px;
      color: #1E1E1E;
      font-weight: 500;
      line-height: 1.55;
      transition: background 0.25s ease, box-shadow 0.25s ease;
      /* REMOVED: min-height: 50px; */
      flex: 1; /* ADDED: Take available space */
      width: auto;
      box-sizing: border-box;
      overflow-y: auto; /* CHANGED: Enable vertical scrolling */
      overflow-x: hidden; /* ADDED: Disable horizontal scrolling */
      min-height: 0; /* ADDED: Allow shrinking in flex container */
    }

    .tsRewrittenText:hover {
      background: #DDD7FF;
      box-shadow: 0 0 6px rgba(108, 99, 255, 0.25);
    }

    /* METALLIC OVERLAY */
    .tsRewrittenText .metallic-shader {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        120deg,
        transparent 0%,
        var(--metallic-color, rgba(255, 255, 255, 0.5)) 50%,
        transparent 100%
      );
      transform: translateX(-100%);
      animation: metallic-move 1.8s infinite linear;
      pointer-events: none;
    }

    @keyframes metallic-move {
      to {
        transform: translateX(100%);
      }
    }

    /* Ensure both text containers have equal available height */
    .tsLeftContainer,
    .tsRewrittenBlock {
      flex: 1;
      min-height: 0;
      padding:4px;
    }

    /* Make text actions container not take up flex space when hidden */
    .tsTextActions {
      flex-shrink: 0;
      height: 0; /* Collapse when hidden */
      overflow: hidden;
    }

    .tsRewrittenBlock:hover .tsTextActions {
      height: auto; /* Expand when visible */
      overflow: visible;
    }

    /* Equalize padding for both text areas */
    .tsOriginalText,
    .tsRewrittenText {
      padding: 10px 12px; /* Make them the same */
    }

    /* Optional: If you want to keep the original padding but still equalize heights */
    .tsRewrittenText {
      padding: 10px 14px; /* Compromise - same vertical padding as original */
    }

    .tsOriginalText,
    .tsRewrittenText {
      word-wrap: break-word; /* Break long words */
      word-break: break-word; /* Alternative for better support */
      overflow-wrap: break-word; /* Modern property */
    }

    /* Action buttons container */
    .tsTextActions {
      display: flex;
      gap: 6px;
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      justify-content: flex-end;
      width: 100%;
      flex-shrink: 0; /* ADDED: Prevent buttons from shrinking */
    }

    /* Show when parent is hovered */
    .tsRewrittenBlock:hover .tsTextActions {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    /* Individual buttons */
    .tsIconButton {
      background: #6C63FF;
      border: none;
      color: white;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transform: translateY(4px);
      animation: none;
    }

    /* Add staggered entrance */
    .tsRewrittenBlock:hover .tsIconButton {
      animation: tsIconFadeIn 0.35s forwards ease-out;
    }

    .tsRewrittenBlock:hover .tsIconButton:nth-child(2) {
      animation-delay: 0.1s;
    }

    /* Hover style for buttons */
    .tsIconButton:hover {
      background: #554fcf;
    }

    /* Animation keyframes */
    @keyframes tsIconFadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .tsIconButton.copied {
      width: auto;               /* Let it expand to fit text */
      height: auto;
      padding: 4px 10px;         /* Give breathing room */
      border-radius: 12px;       /* Less round, more pill-shaped */
      background: #4CAF50;       /* Success green */
      font-weight: 600;
      opacity: 1;
      transform: scale(1.05);
    }
    .tsIconButton.copied:hover {
      background: #4CAF50;
    }

    /* Dark mode adjustments */
    @media (prefers-color-scheme: dark) {
      .tsRewrittenText {
        background: #2F274D;
        color: #EAEAEA;
      }

      .tsRewrittenText:hover {
        background: #3A3160;
      }

      .tsIconButton {
        background: #8378FF;
        color: #1E1E1E;
      }

      .tsIconButton:hover {
        background: #9A91FF;
      }
    }

    /* === CAPTION === */
    .tsCaption, tsTextLabel {
      padding: 8px;
      font-size: 14px;
      color: #d4dbe2ff;
      text-align: left;
      font-weight:bold;
      /*margin-right: 12px;*/
      flex-shrink: 0; /* ADDED: Prevent caption from shrinking */
    }

    @media (prefers-color-scheme: dark) {
      .tsCaption {
        color: #ffffffff;
      }
    }

    .tsAIBadgeLabel {
      padding-right: 16px;
      font-size: 14px;
      text-align: right;
      color : #aeb9bdff;
      flex-shrink: 0; /* ADDED: Prevent caption from shrinking */
    }

    /* === ACTION BAR === */
    .tsActionBar {
      display: flex;
      justify-content: flex-start; /* children start from left */
      gap: 10px;
      transition: all 0.3s ease;  /* optional for smooth container changes */
      padding-bottom:10px;
      padding-left: 10px;
      flex-shrink: 0; /* ADDED: Prevent action bar from shrinking */
    }
    .tsActionBar button:not(#tsReplaceButton) {
      flex: 1 1 auto;          /* grow and shrink as needed */
      min-width: 60px;         /* optional minimum width */
      transition: flex 0.3s ease, width 0.3s ease;  /* smooth size changes */
    }

    .tsActionButton {
      background: #6C63FF;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.25s ease, transform 0.1s ease;
    }

    .tsActionButton:hover {
      background: #5148E0;
      transform: scale(1.04);
    }

   /* === SPINNER === */
  .tsLeftContainer {
    position: relative; /* Create positioning context */
  }

  #tsSpinnerContainer {
    position: absolute;
    backdrop-filter: blur(1.5px);
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    z-index: 1;
  }

    .tsSpinner {
      width: 24px;
      height: 24px;
      border: 4px solid rgba(0,0,0,0.1);
      border-top: 4px solid #6C63FF;
      border-radius: 50%;
      animation: ts-spin 0.8s linear infinite;
      display: none;
    }

    @media (prefers-color-scheme: dark) {
      .tsSpinner {
        border: 4px solid rgba(255,255,255,0.1);
        border-top-color: #6C63FF;
      }
    }

    @keyframes ts-spin {
      to { transform: rotate(360deg); }
    }

    /* === FLEX CONTAINER FOR ORIGINAL + REWRITTEN === */
    .tsTextFlexContainer {
      padding:10px;
      display: flex;
      align-items: stretch; /* CHANGED: from flex-start to stretch */
      width: 100%;
      height: 100%;
      margin-top: 16px;
      box-sizing: border-box;
      flex: 1; /* ADDED: Take available space */
      overflow: hidden; /* ADDED: Prevent container scrolling */
      min-height: 0; /* ADDED: Crucial for flex scrolling */
      gap: 16px; /* ADDED: Use gap instead of margin */
    }

    .tsTextFlexContainer > div {
      flex: 1;
      box-sizing: border-box;
      display: flex; /* ADDED: Flex for inner containers */
      flex-direction: column; /* ADDED: Vertical layout */
      min-height: 0; /* ADDED: Allow shrinking */
    }

    /* REMOVED: Margin in favor of gap */
    .tsTextFlexContainer > div:not(:last-child) {
      margin-right: 0;
    }

    /* Responsive behavior: stack children vertically on small screens */
    @media (max-width: 600px) {
      .tsTextFlexContainer {
        flex-direction: column;
      }
        
      .tsTextFlexContainer > div:not(:last-child) {
        margin-right: 0;
        margin-bottom: 16px;
      }
    }

    #tsReplaceButton:disabled {
      background: #AAA !important;
      cursor: not-allowed;
    }
    #tsReplaceButton:hover:disabled {
      background: #AAA !important;
      transform: none !important;
    }

    #tsReplaceButton {
      margin-left: auto;       /* push to far right */
      width: 100px;            /* fixed width */
      height: 36px;            /* fixed height */
      flex-shrink: 0;          /* prevents shrinking */
      display: none;
      align-items: center;
      justify-content: center;
      transition: background 0.3s ease, transform 0.3s ease; /* smooth hover/copy */
    }

    .tsActionButton:disabled {
      background: #AAA !important;
      cursor: not-allowed;
    }
    .tsActionButton:disabled:hover {
      background: #AAA !important;
      cursor: not-allowed;
      transform: none !important;
    }
    /* Retry button - small pill that follows the primary theme */
    .tsRetryBtn {
      all: unset;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #fff;
      color: #6C63FF;
      border: 1px solid rgba(108,99,255,0.12);
      padding: 6px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 8px;
      box-shadow: 0 6px 16px rgba(108,99,255,0.06);
      transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    }

    .tsRetryBtn:hover { 
      background: #e4dedeff;
      transform: translateY(-1px);
    }
    .tsRetryBtn:active { transform: scale(0.98); }
    .tsRetryBtn:hover:disabled {cursor:wait}
    .tsRetryBtn:hover:disabled {
        background: #AAA !important;
        transform: none !important;
      }
  `;

  //createModePresetCard()
  async function showMicroCard(originalTextOrSelection="No text selected. Select a text to start",
     rewriteMapKey){
    const card = await createModePresetCard(originalTextOrSelection, rewriteMapKey)
    if(!card){
      console.error("Error creating micro card")
    }
    if (originalTextOrSelection && rewriteMapKey){
      // Wait for buildOutputDisplayUI to finish populating the card before returning.
      // buildOutputDisplayUI is async because it awaits storage and other async builders.
      await buildOutputDisplayUI(originalText, rewriteMapKey, card)
    }
  }

  //updateOutputDisplayUI
  function updateOutputDisplayUI(rewrittenText, data={}, attempt=0){
    // Try to find the microcard in DOM; fall back to the last created reference refineMicroCard
    const microcard = getActiveMicrocard()
    // Debug log to help trace timing issues
    //console.log("Microcard: ", microcard, "(attempt:", attempt, ")")

    // If microcard still isn't ready, retry a few times with a short delay
    if(!microcard){

      if (attempt < 20) {
        console.log("retrying to get microcard")
        setTimeout(() => updateOutputDisplayUI(rewrittenText, data, attempt + 1), 80);
        return
      } else {
        console.warn("updateOutputDisplayUI: microcard not available after retries");
      }
      return
    }

    let el = microcard.querySelector(".tsRewrittenText")
    if(!el) console.log("rewritten el: ", el)

    //if(spinner) spinner.style.display = "none"
    if(data.useLocalModel && data.status !== "available"){
      console.log("From local model: ", data.useLocalModel)
      if (data.status === 'downloadable' || data.status === 'downloading') {
        helperFunctions.showModelDownloadPrompt(el, startRewrite)
      }else if(data.status === "error"){
        el.textContent = "Something went wrong."
        addRetryAction(el, startRewrite)
      }else if(data.status === "unavailable"){
        el.textContent = data.message || `Model ${data.status}`;
        helperFunctions.showUseCloudeModelOption(el, startRewrite)
      }
    }else if(data.useCloudModel && data.staus !== "available"){
      if(data.status === "error"){
        el.textContent = "Something went wrong."
        addRetryAction(el, startRewrite)
      }
    }

    if (data.status == "available"){
      if (el)
        el.textContent = ""
        el.innerHTML = helperFunctions.simpleMarkdownToHTML(rewrittenText)
        //setOwnText(el, rewrittenText)
        
      if(!el) console.log("success but el is: ", el)

      const actionBar = microcard.querySelector(".tsActionBar")
      actionBar.style.display = "flex"

      const replaceBtn = microcard.querySelector("#tsReplaceButton")
      replaceBtn.disabled=false
      /*replaceBtn.style.display = "flex"*/

      microcard.querySelector(".tsRetryBtn")?.remove()

      //microcard.querySelector(".tsTextActions").style.display = "flex"

    } 
    
    removeSpinnerFromRewrittenText()
    const allChips = microcard.querySelectorAll(".tsChip");
    allChips.forEach((c) => {
      if(c.classList.contains("tsActive")){
        const modeCaption = microcard.querySelector(".tsCaption")
        modeCaption.textContent = `✨ ${c.textContent} AI refined text`
      }
      c.disabled = false
    });
  }

  function addRetryAction(containerEl, callback=nulll) {
    const existing = getActiveMicrocard().querySelector('.tsRetryBtn');
    if (existing) return;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'tsRetryBtn';
    retryBtn.textContent = 'Retry';
    retryBtn.style.marginTop = '8px';
    retryBtn.onclick = async(ev) => {
      callback()
      await showSpinnerOnRewrittenText()
      retryBtn.disabled=true
      //retryBtn.remove()
    };
    containerEl.appendChild(retryBtn);
  }

  function setOwnText(el, text) {
    let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.nodeValue = text;
    } else {
      el.insertBefore(document.createTextNode(text), el.firstChild);
    }
    //console.log(`set text of ${el} with text:${text}`)
  }

/* ChatPanel input handler */
async function explainTextInputHelper(userText){
  const addUserMessage = chatPanelModule.addUserMessage
  const addAIResponse = chatPanelModule.addAIResponse
  const sendToGemini = chatPanelModule.sendToGemini
  if(!userText || userText.trim().length === 0) return
  
  sendToGemini(userText)

  return
  addUserMessage(userText)

  // dummy ai response
  setTimeout(() => {
    addAIResponse("Echo: " + userText)
  }, 1000);
  
  console.log("Help me explain: ", userText)
}

})();