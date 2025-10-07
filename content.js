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
  
  const extractScript = document.createElement('script');
  extractScript.src = chrome.runtime.getURL('utils/extractMainText.js');
  extractScript.onload = () => console.log("Extraction script loaded");
  document.documentElement.appendChild(extractScript);

  // add getRewriteContext.js
   const getRewriteContextModule = await import(chrome.runtime.getURL('utils/getRewriteContext.js'));
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
      padding: 12px;
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
  document.body.appendChild(floatingIcon);

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
        background: #b388ff;
        font-weight: 500;
        color: #121212;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover { background: #b388ff; }
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

      <button id="ts-hide-sidebar">Hide Sidebar</button><br>
      
      <hr>

      <label for="ts-mode-select">Mode:</label>
      <select id="ts-mode-select">
        <!-- Options will be populated dynamically -->
      </select>

      <button id="ts-preview" title="Polish your selected text instantly with ToneShift.">Refine</button>
      <button id="ts-apply">Apply</button>
      <button id="ts-undo">Undo</button>
      <button id="ts-reset" title="Remove all applied AI rewritten text from the page.">Reset</button>
      <hr>

      <button id="ts-advanced-toggle">⚙️ Advanced Options</button>

      <div id="ts-advanced-controls" style="display: none;">
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
        hideFloatingPreviewButton();
      }
    } else {
      hideFloatingPreviewButton();
    }
  });

  // Listen for main text from page context
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === 'TONESHIFT_MAIN_TEXT') {
      mainText = event.data.text;
      if (mainText) {
        console.log("Main Text Extracted:", mainText);
      }
    }
  });
  

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


  // Floating button click handler - FIXED: Use stored state
  floatingPreviewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    //console.log("Floating button clicked, stored range:", floatingButtonState.range);
    
    if (floatingButtonState.range) {
      // Create a selection from the stored range
      expandSelectionToParagraph() // expand the selection to a whole paragraph
      const selection = window.getSelection();
      //selection.removeAllRanges();
      //selection.addRange(floatingButtonState.range.cloneRange());
      const range = selection.getRangeAt(0).cloneRange();
      const originalContent = range.cloneContents();
      const mapKey = getMapKey();
      rewriteMap[mapKey] = {range:range, originalContent:originalContent}
      
      console.log(rewriteMap)
      
      isPreviewMode = true
      // Use the same preview logic
      performPreview(mapKey);
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
    const fullPageText = mainText
    const selectedText = selectionText

    const dummy = await getRewriteContextModule.getRewriteContext(pageId, fullPageText, selectedText);
    //return
    const _context = dummy //await getRewriteContextModule.getRewriteContext(pageId, fullPageText, selectedText);

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

    setTimeout(() => {
      createModePresetCard(selection, rewriteMapKey);
    }, 10);

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

      if (isPreviewMode) {
        const rewrittenText = reconstructHTML(lastAIResponse)
        buildOutputDisplayUI(rewrittenText, customModeSelect.value)

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
  // --- Enhanced Inline Preview Functions - FIXED ---
  function applyInlinePreview(rewrittenText, rewriteMapKey) {
    if (!rewriteMapKey) {
      console.error("No rewriteMapKey provided for inline preview.");
      return;
    }

    try {
      //clearInlinePreview();
      hideFloatingPreviewButton()

      // Create preview container
      const previewContainer = document.createElement("aside");
      previewContainer.className = "ts-preview-container";
      previewContainer.setAttribute("role", "region");
      previewContainer.setAttribute("aria-labelledby", "ai-label");

      // Create meta row (badge + button)
      const metaRow = document.createElement("div");
      metaRow.className = "ts-meta";

      // Create AI badge
      const badge = document.createElement("span");
      badge.className = "ts-badge";
      badge.id = "ai-label";
      badge.textContent = "AI Refined text" + latestModeSelect;

      // Create revert button
      const revertButton = createRevertPreviewBtn();
      const mapKey = rewriteMapKey;
      revertButton.id = mapKey;
      revertButton.textContent = "Back to original text";
      revertButton.classList.add("ts-revert-button");

      // Handle revert click
      revertButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const { range, originalContent } = rewriteMap[mapKey];
        range.deleteContents();
        console.log(originalContent)
        const restored = originalContent.cloneNode(true);
        range.insertNode(restored);

        // Cleanup state
        delete rewriteMap[mapKey];
        //previewRange = null;
        //previewOriginalContent = null;
        isPreviewMode = false;
      });

      // Append badge + button to meta
      metaRow.appendChild(badge);
      metaRow.appendChild(revertButton);

      // Create text container
      const fragment = document.createRange().createContextualFragment(rewrittenText);
      const textContainer = document.createElement("div");
      textContainer.className = "ts-preview-text-highlight";
      textContainer.appendChild(fragment);

      // Assemble final structure
      previewContainer.appendChild(metaRow);
      previewContainer.appendChild(textContainer);


      // Replace the content
      const {range, originalNodes} = rewriteMap[rewriteMapKey]
      undoStack.push({range:range, originalNodes:originalNodes})
      //rewriteMap[mapKey] = {range:previewRange, originalNodes:previewOriginalContent}
      range.deleteContents();
      range.insertNode(previewContainer);

      currentPreviewElement = previewContainer;
      console.log("Inline preview applied with HTML reconstruction");
      
      return mapKey // return the key for this inline in the rewriteMapKey

    } catch (error) {
      console.error("Error applying inline preview:", error);
      outputBox.textContent = aiResponse;
    }
  }

  function revertInlinePreview(mapKey, removeEntry=false) {
    const { range, originalNodes } = rewriteMap[mapKey];

    if (!range || ! originalNodes){
      console.error("Error reverting inline preview:", error);
      return
    } 

    range.deleteContents();
    const restored = originalNodes.cloneNode(true);
    range.insertNode(restored);

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
  let rewrittenText = ""
  let microcardRewrittenEl = document.createElement("div")
  let microcardOriginalEl = document.createElement("div")
  let microcardRewriteMapKey = null

async function createModePresetCard(originalTextOrSelection, rewriteMapKey) {
  originalText = "This is a sample text to refine.";
  let rect = null;

  if(!rewriteMapKey){
    console.error("No rewriteMapKey provided to createModePresetCard");
    return
  }

  microcardRewriteMapKey = rewriteMapKey;

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

  //const lastUsed = localStorage.getItem("tsLastMode");
  const { tsLastMode: lastUsed } = await chrome.storage.local.get("tsLastMode");


  if (lastUsed) {
    showSpinnerThenRewrite(card, originalText, lastUsed);
  } else {
    buildModeSelectionUI(card, originalText);
  }

  // === Positioning Logic === //
  if (rect && rect.width > 0) {
    console.log("Positioning card near selection:", rect);
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const top = rect.top + scrollY - 10;
    const left = rect.left + scrollX + rect.width / 2;
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.transform = "translate(-50%, -100%)";
  } else {
    // Fallback center position
    card.style.top = "40%";
    card.style.left = "50%";
    card.style.transform = "translate(-50%, -50%)";
  }

  // Track anchor position
  const anchorY = rect ? rect.top + window.scrollY : window.innerHeight * 0.4;

  // Fade-out function
  function gracefullyRemoveCard() {
    if (!card.isConnected) return;
    cleanupListeners();
    card.style.transition = 'opacity 0.3s ease';
    card.style.opacity = '0';
    setTimeout(() => {
      if (card.isConnected) card.remove();
    }, 300);
  }


  // Scroll listener: fade out if scrolled 300px away
  function handleScroll() {
    const currentY = window.scrollY;
    if (Math.abs(currentY - anchorY) > 300) {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('selectionchange', handleSelection);
      gracefullyRemoveCard();
    }
  }

  // Selection listener: fade out on new highlight
  function handleSelection() {
    const sel = window.getSelection();
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

  // 🧹 Centralized cleanup function
  function cleanupListeners() {
    window.removeEventListener("scroll", handleScroll);
    document.removeEventListener("selectionchange", handleSelection);
    document.removeEventListener("mousedown", handleClickOutside);
  }

  return card

}

  // === Build Mode Selection UI === //
  async function buildModeSelectionUI(card, originalText) {
    card.innerHTML = "";

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
      chip.onclick = () => handleModeClick(mode, chip, card, originalText);
      chipContainer.appendChild(chip);
    });

    const spinner = document.createElement("div");
    spinner.className = "tsSpinner";
    spinner.textContent = "Adjusting for your mode…";
    spinner.style.display = "none";

    card.append(chipContainer, spinner);
  }

  async function buildModeSelectionCard(card, originalText) {
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
      chip.onclick = () => handleModeClick(mode, chip, card, originalText);
      chipContainer.appendChild(chip);
    });

    const chip = document.createElement("button");
    chip.className = "tsChip";
    chip.textContent = "x";
    chip.onclick = (() => {
      chipContainer.style.display = "none";
    })
    chipContainer.appendChild(chip)
    return chipContainer
  }
  
  // === Handle Mode Selection === //
  async function handleModeClick(mode, chip, card, originalText) {
    //localStorage.setItem("tsLastMode", mode);
    await chrome.storage.local.set({ tsLastMode: mode });
    const profile = allPresets[mode];
    applyProfile(profile)

    const allChips = card.querySelectorAll(".tsChip");
    allChips.forEach((c) => c.classList.remove("tsActive"));
    chip.classList.add("tsActive");

    //const spinner = card.querySelector(".tsSpinner");
    //spinner.style.display = "block";
    performPreview(microcardRewriteMapKey)

    microcardRewrittenEl.textContent = "";
    return
  }

  // === Show Spinner (Skip Mode Selection Path) === //
  function showSpinnerThenRewrite(card, originalText, mode) {
    card.innerHTML = "";
    const spinner = document.createElement("div");
    spinner.className = "tsSpinner";

    const spinnerText = {
      Simplify: "Simplifying text…",
      "Easy Read": "Making it easier to read…",
      Formal: "Formalizing text…",
      Creative: "Rewriting creatively…",
      Concise: "Condensing text…",
    }[mode] || "Adjusting text…";

    spinner.textContent = spinnerText;
    card.appendChild(spinner);

    return
    setTimeout(() => {
      const rewritten = generateFakeRewrite(originalText, mode);
      buildOutputDisplayUI(card, originalText, rewritten, mode);
    }, Math.random() * 2000 + 500);
  }

  // === Generate Fake Rewrite (placeholder for AI) === //
  function generateFakeRewrite(text, mode) {
    const variants = {
      Simplify: text.replace(/sample/, "simple") + " (simplified)",
      "Easy Read": text + " It's now easier to read and clearer.",
      Formal: text.replace("sample", "demonstrative") + " — formally adjusted.",
      Creative: text + " The sentence now has a touch of creativity.",
      Concise: text.replace("This is a sample text to refine.", "Refined text."),
    };
    return variants[mode] || text + " (refined)";
  }

  
// === Build Output Display (Original + Rewritten + Actions) === //
async function buildOutputDisplayUI(rewrittenText, mode) {

  let rMKN = document.createElement("span"); // simple node used to store rewriteMapKey returned by applyInlinePreview
                                            // the id property is used.

  rewrittenText = rewrittenText
  const card = refineMicroCard;
  card.innerHTML = "";

  const outputContainer = document.createElement("div");
  outputContainer.className = "tsOutputContainer";
  if(outputContainer.isConnected){
   const rewrittenEl =  document.querySelector(".tsRewrittenText")
   rewrittenEl.textContent = rewrittenText
  }

  const originalEl = document.createElement("div");
  originalEl.className = "tsOriginalText";
  originalEl.textContent = originalText;
   originalEl.onclick = () => {
    originalEl.classList.toggle("expanded");
  };
  microcardOriginalEl = originalEl;

  const rewrittenEl = document.createElement("div");
  rewrittenEl.className = "tsRewrittenText";
  rewrittenEl.textContent = rewrittenText;
  microcardRewrittenEl = rewrittenEl

  const caption = document.createElement("div");
  caption.className = "tsCaption";
  caption.textContent = mode
    ? `${mode} version — Local AI`
    : "AI generated (local).";

  const actionBar = document.createElement("div");
  actionBar.className = "tsActionBar";

  const btnReplace = createActionButton("Replace", () =>
    handleReplace(rewrittenText)
  );
  const btnUndo = createActionButton("Undo", () =>
    handleUndo()
  );
  btnUndo.style.display="none" // hide the undo button. we don't need it since the microcard fades-out on replace with rewritten text
  undoReplaceButton = btnUndo

  const btnChange = createActionButton("Change Mode", () =>
    buildModeSelectionUI(card, originalText)
  );

  const modeSelectionCard = await buildModeSelectionCard(refineMicroCard, originalText)
  actionBar.append(modeSelectionCard,btnReplace, btnUndo, btnChange);

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

  outputContainer.append(originalEl, rewrittenEl, caption, actionBar);
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
    btn.textContent = label;
    btn.onclick = handler;
    return btn;
  }

  function handleReplace(rewrittenText) {
    applyInlinePreview(rewrittenText, microcardRewriteMapKey)
    easeOutMicroCard()
  }

  function handleUndo(rewriteMapKey=null) {
    if(typeof rewriteMapKey !== "string") return
    revertInlinePreview(rewriteMapKey)
  }

  // === Inject Styles === //
  const floatingRefinePopupStyle = document.createElement("style");
  floatingRefinePopupStyle.textContent = `
    .tsMicrocard {
      position: fixed; /* stays fixed on screen */
      background: white;
      border: 1px solid #ccc;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 16px;
      z-index: 1000;
      font-family: sans-serif;
      width: 320px;
      transition: opacity 0.2s ease;
      overflow: hidden;
    }

    .tsCloseButton {
      position: absolute; /* positions relative to the card box */
      top: 8px;
      right: 10px;
      background: none;
      border: none;
      color: #888;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s ease;
      margin-botton:4px;
    }

    .tsCloseButton:hover {
      color: #333;
    }

    .tsChipContainer {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .tsChip {
      background: #f0f0f0;
      border: none;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .tsChip:hover { background: #e0e0e0; }
    .tsChip.tsActive { background: #007bff; color: white; }

    .tsSpinner {
      text-align: center;
      color: #555;
      font-size: 14px;
      padding: 12px 0;
    }

    .tsOutputContainer {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tsOriginalText {
      opacity: 0.5;
      font-size: 14px;
      border-bottom: 1px dashed #ccc;
      padding-bottom: 6px;
      max-height: 6.5em; /* ~5 lines */
      overflow: hidden;
      position: relative;
      cursor: pointer;
      transition: max-height 0.3s ease;
      margin-bottom: 6px;
      margin-top: 20px;
    }

    .tsOriginalText::after {
      content: "Show more";
      position: absolute;
      bottom: 0;
      right: 0;
      background: linear-gradient(to left, white 50%, transparent);
      color: #007bff;
      font-size: 12px;
      padding-left: 20px;
      cursor: pointer;
    }

    .tsOriginalText.expanded {
      max-height: none;
    }

    .tsOriginalText.expanded::after {
      content: "Show less";
    }


    .tsRewrittenText {
      opacity: 1;
      font-size: 15px;
    }

    .tsCaption {
      font-size: 12px;
      color: #666;
      text-align: right;
    }

    .tsActionBar {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
    }

    .tsActionButton {
      background: #f0f0f0;
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      cursor: pointer;
      transition: background 0.2s;
      font-size: 13px;
    }

    .tsActionButton:hover { background: #e0e0e0; }

    .tsOriginalText,
    .tsRewrittenText {
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 8px 10px;
      background: #fafafa;
    }
  `;
  document.head.appendChild(floatingRefinePopupStyle);

  //createModePresetCard()
  function showMicroCard(originalTextOrSelection="No text selected. Select a text to start",
     rewriteMapKey){
    const card = createModePresetCard(originalTextOrSelection, rewriteMapKey)
    if (originalTextOrSelection && rewriteMapKey){
      //buildOutputDisplayUI()
    }
  }

})();