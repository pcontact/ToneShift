(async () => {
  if (document.getElementById("toneshift-sidebar-host")) return;

  console.log("ToneShift sidebar injected!");

  // --- Inject helper scripts into page context ---
  const loaderScript = document.createElement("script");
  loaderScript.type = "module";
  loaderScript.src = chrome.runtime.getURL("pageGeminiLoader.js");
  document.documentElement.appendChild(loaderScript);

  const hybridScript = document.createElement("script");
  hybridScript.type = "module"
  hybridScript.src = chrome.runtime.getURL("pageHybrid.js");
  document.documentElement.appendChild(hybridScript);

  const extractMainTextModule = await import(chrome.runtime.getURL('utils/extractMainText.js'));

  // add getRewriteContext.js
   const getRewriteContextModule = await import(chrome.runtime.getURL('utils/getRewriteContext.js'));

   const chatPanelModule = await import(chrome.runtime.getURL('chatPanel.js'));
  //console.log("::::",await getRewriteContextModule.getPageSummary(window.location.href, "the sky is blue"))
  
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
    .ts-floating-preview-btn:hover {
      background: #2a1b4d;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
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

  // page main text contents
  let mainText = null

  // --- Floating icon ---
  const floatingIcon = document.createElement("div");
  floatingIcon.id = "ts-floating-icon";
  floatingIcon.textContent = "TS";
  floatingIcon.style.display = "none";
  //document.body.appendChild(floatingIcon);

  // --- Floating preview button ---
  const floatingPreviewBtn = document.createElement("button");
  floatingPreviewBtn.className = "ts-floating-preview-btn";
  floatingPreviewBtn.textContent = "✨ Refine";
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
  explainBtn.title = "Get a detailed explanation of the selected text."
  fPBContainer.appendChild(explainBtn)

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

        <label for="gemini-cloud-model-toggle" style="font-weight:600">Use Cloud Gemini Model</label>
        <button id="ts-set-key">🔑 Set Gemini API Key</button><br>
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
  let latestModeSelect = ""

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
    Simplify: { tone: 2, complexity: 2, brevity: 8 },
    "Easy Read": { tone: 6, complexity: 2, brevity: 8 },
    "Casual": { tone: 5, complexity: 5, brevity: 5 },
    "Shorten": { tone: 2, complexity: 2, brevity: 8 },
    "Formalize": { tone: 8, complexity: 9, brevity: 7 },
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
        if (enabled === undefined || enabled === null || enabled === true) {
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
  function toggleSpinner(range, enable) {
    if (enable) {
      if (!range) return;

      // Capture the range so we can keep tracking after deselection
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

  explainBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    expandSelectionToSentence()
    const selection = window.getSelection();
    chatPanelModule.openChatPanel(selection)
    if (!chatPanelModule.isInputHandlerSet){ // we need only one input handler for this.
      chatPanelModule.attachInputHandler(explainTextInputHelper)
    }
    hideFloatingPreviewButton();
    
  })

  document.addEventListener("load", (e)=>{
    mainText = extractMainTextModule.extractMainTextFromDocument(document)
    console.log("Extracted main text: ", mainText)
  })

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


  // Floating button click handler - FIXED: Use stored state
  floatingPreviewBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    //console.log("Maintext:", extractMainTextModule.extractMainTextFromDocument(document));
    
    if (floatingButtonState.range) {
      // Create a selection from the stored range
      expandSelectionToSentence()
      const parentParagraph = getSelectionParentParagraph()
      //expandSelectionToParagraph() // expand the selection to a whole paragraph
      const selection = window.getSelection();
      //selection.removeAllRanges();
      //selection.addRange(floatingButtonState.range.cloneRange());
      const range = selection.getRangeAt(0).cloneRange();
      const originalContent = range.cloneContents();
      const mapKey = getMapKey();
      rewriteMap[mapKey] = {range:range, originalContent:originalContent, parentParagraph:parentParagraph};
      
      //console.log(rewriteMap)
      
      isPreviewMode = true

      //#microcard testing
      /*
      setTimeout(() => {
      showMicroCard(selection, mapKey);
      }, 10);

      hideFloatingPreviewButton();

      setTimeout(()=>{
        updateOutputDisplayUI("Something went wrong", false)
      }, 2000)
      return
      */

      // Ensure microcard is created and populated before sending the preview request
      // Awaiting showMicroCard avoids a race where the AI response arrives before
      // the microcard DOM exists (which previously caused document.querySelector to return null).
      setTimeout(async () => {
        await showMicroCard(selection, mapKey);
      }, 20);
      

      // Use the same preview logic (now that the microcard exists)
      await performPreview(mapKey);

      
      
      
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

  // --- Show floating preview preference wiring (query from sidebar shadow DOM) ---
  const showFloatingCheckbox = qs('ts-show-floating');
  if (showFloatingCheckbox) {
    // Load saved preference; default to true
    chrome.storage.local.get('showFloatingOnHighlight', (data) => {
      if (data.showFloatingOnHighlight === undefined || data.showFloatingOnHighlight === null) {
        showFloatingCheckbox.checked = true;
      } else {
        showFloatingCheckbox.checked = !!data.showFloatingOnHighlight;
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
  async function performPreview(rewriteMapKey) {
    const selection = rewriteMap[rewriteMapKey].range

    const selectionText = selection.toString().trim();
    if (!selectionText) {
      outputBox.textContent = "No text selected.";
      return;
    }

    //console.log("Performing preview on selection:", selectionText.substring(0, 50) + "...");

    // Clear any existing preview
    //clearInlinePreview();

    // Store selection info for inline preview
    //isPreviewMode = true;
    //previewRange = selection.getRangeAt(0).cloneRange();
    //previewOriginalContent = previewRange.cloneContents();
    

    toggleSpinner(selection, true)
    setLoading(true);

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

    const pageId = window.location.href
    const fullPageText = extractMainTextModule.extractMainTextFromDocument(document)
    const selectedText = selectionText
    //console.log("fullpage text: ", fullPageText)
    const _context = await getRewriteContextModule.getRewriteContext(pageId, fullPageText, selectedText);
    
    // Send to AI
    window.postMessage(
      {
        type: "TS_GEMINI_REQUEST",
        textWithPlaceholders: textWithPlaceholders.trim(),
        textWithoutPlaceholders: selectionText,
        rewriteWithFormat:preserveFormattingCheckbox.checked,
        context:_context,
        ...settings,
      },
      "*"
    );
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
    applyProfile(builtInPresets["Simplify"]);
  });

  // --- Mode Select Event Listener ---
  modeSelect.addEventListener("change", (e) => {
    e.stopPropagation()
    const modeName = modeSelect.value;
    latestModeSelect = modeName;
    console.log("Mode changed to:", latestModeSelect);
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
      const rewrittenText = reconstructHTML(lastAIResponse)
      updateOutputDisplayUI(rewrittenText)
      
      if (isPreviewMode) {
        //applyInlinePreview(lastAIResponse);
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
      updateOutputDisplayUI("Something went wrong. Try again", false)

      
      if (isPreviewMode) {
        isPreviewMode = false;
        previewRange = null;
        previewOriginalContent = null;
      }
    }
  });


  function reconstructHTML(aiResponse){
    // Use the same reconstruction logic as the Apply button
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
      return reconstructedHTML;
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

    const { range, originalNodes, parentParagraph } = mapEntry;
    if (!range || !parentParagraph) {
      console.error("Missing range or parentParagraph in rewriteMap entry.");
      return;
    }

    // --- Compute character offsets of the selection within the parentParagraph ---
    function getOffsetsWithinContainer(rng, container) {
      const beforeStart = document.createRange();
      beforeStart.setStart(container, 0);
      beforeStart.setEnd(rng.startContainer, rng.startOffset);
      const start = beforeStart.toString().length;

      const beforeEnd = document.createRange();
      beforeEnd.setStart(container, 0);
      beforeEnd.setEnd(rng.endContainer, rng.endOffset);
      const end = beforeEnd.toString().length;

      return { start, end };
    }

    const { start: selStart, end: selEnd } = getOffsetsWithinContainer(range, parentParagraph);

    // --- Prepare clones ---
    const originalClone = parentParagraph.cloneNode(true); // pristine copy for revert
    mapEntry.originalClone = originalClone;

    const previewParagraph = parentParagraph.cloneNode(true); // mutated copy for preview

    // --- Create preview container and meta row + revert button ---
    const previewContainer = document.createElement("aside");
    previewContainer.className = "ts-preview-container";
    previewContainer.setAttribute("role", "region");
    previewContainer.setAttribute("aria-labelledby", "ai-label");

    const metaRow = document.createElement("div");
    metaRow.className = "ts-meta";

    const badge = document.createElement("span");
    badge.className = "ts-badge";
    badge.id = "ai-label";
    badge.textContent = "AI Refined text" + (typeof latestModeSelect !== "undefined" ? latestModeSelect : "");

    const revertButton = createRevertPreviewBtn();
    revertButton.textContent = "Back to original text";
    revertButton.classList.add("ts-revert-button");

    metaRow.appendChild(badge);
    metaRow.appendChild(revertButton);

    // --- Map offsets into the cloned paragraph and produce a Range there ---
    function createRangeFromOffsets(container, startOffset, endOffset) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let node;
      let charCount = 0;
      let foundStart = false;
      const newRange = document.createRange();

      while ((node = walker.nextNode())) {
        const nodeLen = node.textContent.length;

        if (!foundStart && charCount + nodeLen >= startOffset) {
          newRange.setStart(node, startOffset - charCount);
          foundStart = true;
        }

        if (foundStart && charCount + nodeLen >= endOffset) {
          newRange.setEnd(node, endOffset - charCount);
          return newRange;
        }

        charCount += nodeLen;
      }

      // If selection ends exactly at container end, and start was found, terminate at last node end
      if (foundStart) {
        // setEnd on the last seen node at its length
        newRange.setEnd(node, node.textContent.length);
        return newRange;
      }

      // couldn't map the offsets
      return null;
    }

    const cloneRange = createRangeFromOffsets(previewParagraph, selStart, selEnd);

    // --- Insert highlight in clone (use a fresh element for insertion) ---
    if (cloneRange) {
      const highlightSpan = document.createElement("span");
      highlightSpan.className = "ts-preview-text-highlight";
      highlightSpan.textContent = rewrittenText;

      cloneRange.deleteContents();
      // If inserting node into a text node boundary, insertNode will split node as needed
      cloneRange.insertNode(highlightSpan);
    } else {
      // Fallback: try a best-effort text replacement or append highlight at end
      console.warn("Could not map selection into cloned paragraph; appending highlight at end as fallback.");
      const fallbackSpan = document.createElement("span");
      fallbackSpan.className = "ts-preview-text-highlight";
      fallbackSpan.textContent = rewrittenText;
      previewParagraph.appendChild(fallbackSpan);
    }

    // --- Assemble preview and replace original paragraph ---
    previewContainer.appendChild(metaRow);
    previewContainer.appendChild(previewParagraph);

    // Keep an undo record (you might want to store originalClone here too)
    undoStack.push({ range, originalNodes, parentParagraph });

    parentParagraph.replaceWith(previewContainer);
    currentPreviewElement = previewContainer;
    isPreviewMode = true;

    // --- Revert logic: replace preview with the pristine original clone ---
    revertButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const container = e.target.closest(".ts-preview-container");
      const entry = rewriteMap[rewriteMapKey];
      const cloneForRestore = entry && entry.originalClone;

      if (!container || !cloneForRestore) {
        console.error("Missing preview container or original clone for revert.");
        return;
      }

      container.replaceWith(cloneForRestore);
      delete rewriteMap[rewriteMapKey];
      isPreviewMode = false;
      console.log("Reverted to original paragraph.");
    });

    console.log("Inline preview applied (mapped by character offsets).");
    return rewriteMapKey;

  } catch (error) {
    console.error("Error applying inline preview:", error);
  }
}


  function revertInlinePreview(mapKey, removeEntry=false) {
    const { parentParagraph } = rewriteMap[mapKey];
    const previewContainer = e.target.closest(".ts-preview-container");

    if (!previewContainer || !parentParagraph) {
      console.error("Missing preview container or original paragraph for revert.");
      return;
    }

    // Replace the entire preview container with the original paragraph
    previewContainer.replaceWith(parentParagraph);

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

  // ===================== Create Floating "Refine" Microcard =================================
  // == global variable used among functions
  let originalText = ""
  let refineMicroCard = null
  let microcardRewrittenEl = document.createElement("div")

  async function createModePresetCard(originalTextOrSelection, rewriteMapKey) {
    originalText = "This is a sample text to refine.";
    let rect = null;

    if(!rewriteMapKey){
      console.error("No rewriteMapKey provided to createModePresetCard");
      return
    }

    // Check if a Selection object was passed
    if (originalTextOrSelection && originalTextOrSelection.toString) {
      const selection = originalTextOrSelection;
      originalText = selection.toString().trim() || originalText;
      if (selection.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
      }
    } else if (typeof originalTextOrSelection === "string") {
      originalText = originalTextOrSelection;
    }
    console.log("Creating mode preset card for text:", originalText.substring(0, 30) + "...");

    const card = document.createElement("div");
    card.className = "tsMicrocard";
    document.body.appendChild(card);
    refineMicroCard = card; // store reference for later usage/removal
    //console.log(refineMicroCard)

    // Card positioning logic
    const cardWidth = 380; // match CSS width
    const cardHeight = 150; // approximate; could measure dynamically

    if (rect && rect.width > 0) {
      let top = rect.bottom + window.scrollY + 10;
      let left = rect.left + window.scrollX;

      // Adjust if card would overflow bottom of viewport
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (top + cardHeight > window.scrollY + viewportHeight) {
        top = rect.top + window.scrollY - cardHeight - 10; // position above selection
      }

      // Adjust if card would overflow right edge
      if (left + cardWidth > window.scrollX + viewportWidth) {
        left = window.scrollX + viewportWidth - cardWidth - 10;
      }

      // Adjust if card would overflow left edge
      if (left < 10) {
        left = 10;
      }

      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
    } else {
      // Fallback center
      card.style.top = "40%";
      card.style.left = "50%";
      card.style.transform = "translate(-50%, -50%)";
    }


    // Track anchor position
    const anchorY = rect ? rect.top + window.scrollY : window.innerHeight * 0.4;

    // Hover tracking
    let isMouseOverCard = false;
    card.addEventListener('mouseenter', () => (isMouseOverCard = true));
    card.addEventListener('mouseleave', () => (isMouseOverCard = false));

    // Fade-out function
    function gracefullyRemoveCard() {
      if (!card.isConnected) return;
      console.log("Fading out and removing microcard");
      cleanupListeners();
      card.style.transition = 'opacity 0.3s ease';
      card.style.opacity = '0';
      setTimeout(() => {
        if (card.isConnected) card.remove();
      }, 300);
    }

    // Scroll listener: fade out only if scrolled away AND not hovering
    function handleScroll() {
      const currentY = window.scrollY;
      if (Math.abs(currentY - anchorY) > 200 && !isMouseOverCard) {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('selectionchange', handleSelection);
        gracefullyRemoveCard();
      }
    }

    // Optional: re-enable scroll listener when mouse leaves
    function handleMouseLeave() {
      // if user scrolled while hovering, we re-check immediately upon leaving
      if (Math.abs(window.scrollY - anchorY) > 200) {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('selectionchange', handleSelection);
        gracefullyRemoveCard();
      }
    }



    // Selection listener: fade out on new highlight
    function handleSelection(event) {
      const sel = window.getSelection();
      if (card.contains(event.target)) return; // ignore if selection change originated inside card
      if (sel && sel.toString().trim().length > 0) {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('selectionchange', handleSelection);
        gracefullyRemoveCard();
      }
    }
    // Click-outside listener: fade out when user clicks anywhere not inside the card
    function handleClickOutside(event) {
      if (!card.contains(event.target)) {
        cleanupListeners();
        gracefullyRemoveCard();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('selectionchange', handleSelection);

    card.addEventListener('mouseleave', handleMouseLeave);

    // 🧹 Centralized cleanup function
    function cleanupListeners() {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("selectionchange", handleSelection);
      document.removeEventListener("mousedown", handleClickOutside);
      card.removeEventListener('mouseenter', () => (isMouseOverCard = true));
      card.removeEventListener('mouseleave', () => (isMouseOverCard = false));
      card.removeEventListener('mouseleave', handleMouseLeave);
    }

    return card
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
    chip.onclick = (() => {
      chipContainer.style.display = "none";
      const btn = document.querySelector("#tsChangeModeButton")
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
    applyProfile(profile)


    //const spinner = card.querySelector(".tsSpinner");
    //spinner.style.display = "block";
    //console.log("rewrimapkey: ", rewriteMapKey, " mode: ", mode)
    microcardRewrittenEl.textContent = "";

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

    // #microcard testing
    /*
    setTimeout(() => {
     updateOutputDisplayUI("we are windows")
      
    }, 2000);
    
    return
    */
  }

  // === Show Spinner (Skip Mode Selection Path) === //
  function showSpinner(node, mode) {
    const spinnerContainer = document.createElement("div")
    spinnerContainer.id = "tsSpinnerContainer"

    const spinner = document.createElement("div");
    spinner.className = "tsSpinner";
    spinner.style.display = "block"

    const getSpinnerText = {
      Simplify: "Simplifying text…",
      "Easy Read": "Making it easier to read…",
      Formal: "Formalizing text…",
      Creative: "Rewriting creatively…",
      Concise: "Condensing text…",
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
    card.innerHTML = "";

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
    rewrittenEl.textContent = "";
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
      const self = document.querySelector("#tsChangeModeButton")
      self.style.display = "none"
    };

    textActionButton.appendChild(copyIconButton);
    textActionButton.appendChild(adjustToneButton);

    const caption = document.createElement("div");
    caption.className = "tsCaption";
    caption.textContent = mode
      ? `${mode} version — Local AI`
      : "AI generated (local).";

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
      const self = document.querySelector("#tsChangeModeButton")
      self.style.display = "none"
    });
    btnChange.textContent = "Adjust Tone/Style";

    const modeSelectionCard = await buildModeSelectionCard(refineMicroCard, rewriteMapKey)
    actionBar.append(modeSelectionCard, btnReplace);

    // Create close ("X") button positioned at the top-right
    const btnClose = document.createElement('button');
    btnClose.className = 'tsCloseButton';
    btnClose.textContent = '×';
    btnClose.onclick = () => {
      card.style.transition = 'opacity 0.3s ease';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    };
    // Append to card
    card.prepend(btnClose);

    showSpinner(originalEl, mode)
    
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
    rewrittenBlock.appendChild(rightLabel);
    rewrittenBlock.appendChild(rewrittenEl);
    rewrittenBlock.appendChild(textActionButton);

    tsTextFlexContainer.appendChild(leftContainer);
    tsTextFlexContainer.appendChild(rewrittenBlock);

    outputContainer.append(tsTextFlexContainer, caption, actionBar);
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
      padding: 16px;
      width: 480px;
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
      max-height: 6.5em;
      overflow: hidden;
      position: relative;
      transition: max-height 0.3s ease;
      /* margin-top: 16px; */
    }

    @media (prefers-color-scheme: dark) {
      .tsOriginalText {
        background: #2A2A2A;
        color: #BBB;
      }
    }

    .tsOriginalText::after {
      content: "Show more";
      position: absolute;
      bottom: 0;
      right: 10px;
      background: linear-gradient(to left, #F8F9FA 50%, transparent);
      color: #6C63FF;
      font-size: 12px;
      padding-left: 20px;
      cursor: pointer;
    }

    @media (prefers-color-scheme: dark) {
      .tsOriginalText::after {
        background: linear-gradient(to left, #1E1E1E 50%, transparent);
      }
    }

    .tsOriginalText.expanded {
      max-height: none;
      cursor: zoom-out;
    }

    .tsOriginalText.expanded::after {
      content: "Show less";
    }

    .tsRewrittenBlock {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      position: relative;
      width: 100%;
      boxsizing: border-box;
    }

    /* REWRITTEN TEXT — focus content */
    .tsRewrittenText {
      /* position: relative; */
      background: #E6E0FF;
      border-radius: 8px;
      border-left: 3px solid #6C63FF;
      padding: 12px 14px;
      color: #1E1E1E;
      font-weight: 500;
      line-height: 1.55;
      transition: background 0.25s ease, box-shadow 0.25s ease;
      min-height: 24px; /* optional but recommended */
      flex:1;
      width:auto;
      box-sizing: border-box;

    }

    .tsRewrittenText:hover {
      background: #DDD7FF;
      box-shadow: 0 0 6px rgba(108,99,255,0.25);
    }

    /* Action buttons container */
    .tsTextActions {
      display: flex;
      gap: 6px;
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      justify-content: flex-end; /* add this */
      width: 100%; /* add this */

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
    .tsCaption {
      font-size: 12px;
      color: #6C757D;
      text-align: right;
      margin-top: 8px;
    }

    @media (prefers-color-scheme: dark) {
      .tsCaption {
        color: #A0A0A0;
      }
    }

    /* === ACTION BAR === */
    .tsActionBar {
      display: none;
      justify-content: space-between;
      margin-top: 12px;
      gap: 10px;
    }
    .tsActionBar {
      display: flex;
      justify-content: flex-start; /* children start from left */
      gap: 10px;
      transition: all 0.3s ease;  /* optional for smooth container changes */
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
      padding: 6px 14px;
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
    #tsSpinnerContainer {
      position: absolute;
      //background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(1px);
      width: 100%;
      height: 100%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
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
      display: flex;
      align-items: flex-start;
      width: 100%;
      height: 100%;
      margin-top: 16px;
      box-sizing: border-box;
    }

    .tsTextFlexContainer > div {
      flex: 1;
      box-sizing: border-box;
    }

    .tsTextFlexContainer > div:not(:last-child) {
      margin-right: 16px;
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
  `;

  document.head.appendChild(floatingRefinePopupStyle);

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
  function updateOutputDisplayUI(rewrittenText, success=true, attempt=0){
    // Try to find the microcard in DOM; fall back to the last created reference refineMicroCard
    const microcard = document.querySelector(".tsMicrocard") || refineMicroCard;
    // Debug log to help trace timing issues
    //console.log("Microcard: ", microcard, "(attempt:", attempt, ")")

    // If microcard still isn't ready, retry a few times with a short delay
    if(!microcard){
      if (attempt < 6) {
        setTimeout(() => updateOutputDisplayUI(rewrittenText, success, attempt + 1), 80);
      } else {
        console.warn("updateOutputDisplayUI: microcard not available after retries");
      }
      return
    }

    const el = microcard.querySelector(".tsRewrittenText")
    if (el) setOwnText(el, rewrittenText)
    const spinner = microcard.querySelector("#tsSpinnerContainer")
    if(spinner) spinner.style.display = "none"

    if (success){
      const actionBar = microcard.querySelector(".tsActionBar")
      actionBar.style.display = "flex"

      const allChips = microcard.querySelectorAll(".tsChip");
      allChips.forEach((c) => {
        if(c.classList.contains("tsActive")){
          const modeCaption = microcard.querySelector(".tsCaption")
          modeCaption.textContent = c.textContent
          ? `${c.textContent} version — Local AI`
          : "AI generated (local).";
        }
        c.disabled = false
      });

      const replaceBtn = microcard.querySelector("#tsReplaceButton")
      replaceBtn.disabled=false
      replaceBtn.style.display = "flex"
    }
  }

  function setOwnText(el, text) {
    let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.nodeValue = text;
    } else {
      el.insertBefore(document.createTextNode(text), el.firstChild);
    }
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