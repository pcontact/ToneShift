/**
 * Position a floating panel (fixed) relative to a Selection.
 * - If no selection is provided, places panel at bottom center of viewport.
 * - Uses selection bounding rect (with fallbacks).
 * - Prefers below, then above; otherwise defaults to bottom center.
 * - Clips so the panel is always fully visible in viewport.
 *
 * @param {Selection} selection - window.getSelection()
 * @param {HTMLElement} panel - element to position (preferably appended to document.body)
 * @param {Object} [opts]
 * @param {number} [opts.margin=8] - gap between selection and panel
 * @param {number} [opts.biasFactor=0.25] - how strongly to shift from center toward selection in fallback (0..1)
 * @param {boolean} [opts.ensureInBody=true] - if true, append panel to document.body when not already inside it
 * @param {number} [opts.width=null] - width of the panel
 * @param {number} [opts.height=null] - height of the panel
 *
 * @returns {{top:number,left:number,placement:string}} positions in viewport px and placement label
 */
export async function positionPanel(selection, panel, opts = {}) {
  const {
    margin = 8,
    biasFactor = 0.25, // reserved for possible future use
    ensureInBody = true,
    width = null,
    height = null,
  } = opts;

  if (!panel) return null;

  // Ensure it's appended to <body> (fixed positioning breaks in transformed parents)
  if (ensureInBody && panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  // --- Wait a frame to let layout stabilize (critical for first call) ---
  await new Promise(r => requestAnimationFrame(r));

  // --- Safe measure, even if display:none ---
  function measurePanel(el) {
    const computed = getComputedStyle(el);
    let restored = null;
    if (computed.display === "none") {
      restored = {
        visibility: el.style.visibility,
        display: el.style.display,
        position: el.style.position,
      };
      el.style.visibility = "hidden";
      el.style.display = "block";
      el.style.position = "fixed";
      if (!el.isConnected) document.body.appendChild(el);
    }
    let w = el.offsetWidth;
    let h = el.offsetHeight;
    if (restored) {
      el.style.visibility = restored.visibility;
      el.style.display = restored.display;
      el.style.position = restored.position;
    }
    if (width) w = width;
    if (height) h = height;
    return { width: w, height: h };
  }

  const { width: panelWidth, height: panelHeight } = measurePanel(panel);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(vw - panelWidth, 0);
  const maxTop = Math.max(vh - panelHeight, 0);

  // --- CASE 1: No selection (default) ---
  if (!selection || selection.rangeCount === 0) {
    const left = Math.round((vw - panelWidth) / 2);
    const top = Math.round(vh - panelHeight - margin);
    panel.style.position = "fixed";
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(0, top)}px`;
    if (!panel.style.zIndex) panel.style.zIndex = "9999";
    return { top, left, placement: "bottom-center" };
  }

  // --- CASE 2: Valid selection ---
  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();

  // Fix zero-sized or collapsed rects
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    if (rects.length > 0) {
      rect = rects[0];
    } else {
      const node = selection.anchorNode?.nodeType === 1
        ? selection.anchorNode
        : selection.anchorNode?.parentElement;
      rect = node?.getBoundingClientRect?.() || null;
    }
  }

  // If we *still* don't have a valid rect, default to bottom center
  if (!rect) {
    const left = Math.round((vw - panelWidth) / 2);
    const top = Math.round(vh - panelHeight - margin);
    panel.style.position = "fixed";
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(0, top)}px`;
    if (!panel.style.zIndex) panel.style.zIndex = "9999";
    return { top, left, placement: "bottom-center" };
  }

  const selectionCenterX = rect.left + (rect.width || 0) / 2;
  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;

  let top = 0;
  let left = 0;
  let placement = "below";

  if (spaceBelow >= panelHeight + margin) {
    top = rect.bottom + margin;
    placement = "below";
  } else if (spaceAbove >= panelHeight + margin) {
    top = rect.top - panelHeight - margin;
    placement = "above";
  } else {
    // fallback: bottom-center of viewport
    top = vh - panelHeight - margin;
    left = (vw - panelWidth) / 2;
    placement = "bottom-center";
  }

  if (placement === "above" || placement === "below") {
    left = selectionCenterX - panelWidth / 2;
  }

  // --- Clamp so it never leaves viewport ---
  left = Math.max(0, Math.min(left, maxLeft));
  top = Math.max(0, Math.min(top, maxTop));

  panel.style.position = "fixed";
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  if (!panel.style.zIndex) panel.style.zIndex = "9999";

  return { top: Math.round(top), left: Math.round(left), placement };
}


/**
 * Positions an element near a point on the screen, using logic similar to positionPanel.
 * It prefers to place the panel below the point, then above, and clips it to the viewport.
 * @param {HTMLElement} panel The element to position.
 * @param {{x: number, y: number}} point The coordinates to position near.
 */
export function positionPanelAtPoint(panel, point) {
  const margin = 8;

  // Helper to measure the panel even if it's hidden
  function measurePanel(el) {
    const computed = getComputedStyle(el);
    let restored = null;
    if (computed.display === 'none') {
      restored = {
        visibility: el.style.visibility,
        display: el.style.display,
        position: el.style.position,
      };
      el.style.visibility = 'hidden';
      el.style.display = 'block';
      el.style.position = el.style.position || 'fixed';
      if (!el.isConnected) document.body.appendChild(el);
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (restored) {
      el.style.visibility = restored.visibility;
      el.style.display = restored.display;
      el.style.position = restored.position;
    }
    return { width: w, height: h };
  }

  const { width: panelWidth, height: panelHeight } = measurePanel(panel);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const rect = { top: point.y, bottom: point.y, left: point.x, width: 0, height: 0 };

  let top = 0;
  let left = 0;
  
  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;

  // Prefer below, then above, otherwise center vertically
  if (spaceBelow >= panelHeight + margin) {
    top = rect.bottom + margin;
  } else if (spaceAbove >= panelHeight + margin) {
    top = rect.top - panelHeight - margin;
  } else {
    top = (vh - panelHeight) / 2;
  }

  // Center horizontally on the point
  left = rect.left - panelWidth / 2;

  // Clip to viewport
  const maxLeft = Math.max(vw - panelWidth, 0);
  const maxTop = Math.max(vh - panelHeight, 0);
  left = Math.min(Math.max(left, 0), maxLeft);
  top = Math.min(Math.max(top, 0), maxTop);

  // Apply final styling
  panel.style.position = 'fixed';
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  if (!panel.style.zIndex) panel.style.zIndex = '9999';
}

/**
 * Show a prompt in the given parentNode to download the built-in model for Chrome’s Prompt API.
 * Once downloaded & ready, remove the UI and call callback(callbackArgs).
 *
 * @param {HTMLElement} parentNode – where to append the UI.
 * @param {Function} callback – function to call once model is ready.
 */
export async function showModelDownloadPrompt(parentNode, callback) {
  // create UI elements
  const container = document.createElement('div');
  container.style = `
    padding: 1em;
    /*border: 1px solid #888;*/
    /*background: #f9f9f9;*/
    max-width: 400px;
    font-family: sans-serif;
  `;
  
  const message = document.createElement('p');
  message.textContent = "Needs to download Chrome AI model.";
  container.appendChild(message);
  
  const button = document.createElement('button');
  button.style = `
      cursor:pointer;
  `
  button.textContent = "Download model";
  container.appendChild(button);
  
  const statusLabel = document.createElement('p');
  statusLabel.style = "margin-top:0.5em; font-style:italic;";
  //container.appendChild(statusLabel);
  
  parentNode.appendChild(container);
  
  // click handler to start download
  button.addEventListener('click', async () => {
    //button.disabled = true;
    //statusLabel.textContent = "Downloading built-in AI model. Please wait…";
    //setOwnText(message, "Downloading built-in AI model. Please wait…")
    
    try {
      // check availability
      const LM = getLanguageModelNamespace()
      const availability = await LM.availability()
      // According to docs: if availability is 'downloadable' or 'downloading', you need to initiate create() to download. :contentReference[oaicite:2]{index=2}
      if (availability === 'downloadable' || availability === 'downloading') {
        // initiate download & monitor
        const session = await LM.create({
          monitor(m) {
            button.style.display="none";
            m.addEventListener('downloadprogress', (e) => {
              const pct = Math.round(e.loaded * 100);
              //statusLabel.textContent = `Downloading… ${pct}%`;
              //setOwnText(message, `Downloading… ${pct}%`)

              setOwnText(message, `Downloading built-in AI model. Please wait… ${pct}%`)
              
            });
          }
        });
        // after create resolves, model is ready
        //statusLabel.textContent = "Getting ready…";
        setOwnText(message, "Getting ready…")
    
        // small delay so user sees “Getting ready” state (optional)
        await new Promise(resolve => setTimeout(resolve, 500));
        // clean up UI
        parentNode.removeChild(container);
        // invoke callback
        callback();
      } else if (availability === 'readily') {
        // already available
        parentNode.removeChild(container);
        callback();
      } else {
        // unavailable
        //statusLabel.textContent = "Model unavailable on this device/browser.";
        setOwnText(message, "Model unavailable on this device/browser.")
        console.warn("LanguageModel availability:", availability);
      }
    } catch (err) {
      console.error("Error downloading or creating model session:", err);
      //statusLabel.textContent = "Error downloading model.";
      setOwnText(message, "Error downloading model.")
    }
  });
}

export function getLanguageModelNamespace() {
  const LM =
    (typeof LanguageModel !== "undefined" && LanguageModel) ||
    globalThis?.ai?.languageModel ||
    globalThis?.chrome?.ai?.languageModel ||
    globalThis?.chrome?.aiOriginTrial?.languageModel ||
    null;

  return (LM && typeof LM.create === "function" && typeof LM.availability === "function") ? LM : null;
}

function setOwnText(el, text) {
    let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
        textNode.nodeValue = text;
    } else {
        el.insertBefore(document.createTextNode(text), el.firstChild);
    }
}

export function showUseCloudeModelOption(parentNode, callback){
  // create UI elements
  const container = document.createElement('div');
  container.style = `
    padding-top:1px;
    /*border: 1px solid #888;*/
    /*background: #f9f9f9;*/
    max-width: 400px;
    font-family: sans-serif;
  `;
  
  const message = document.createElement('p');
  message.textContent = "Needs to download Chrome AI model.";
  //container.appendChild(message);
  
  const button = document.createElement('button');
  button.className = "tsRetryBtn "
  button.textContent = "Try Cloud model";
  container.appendChild(button);
  
  const statusLabel = document.createElement('p');
  statusLabel.style = "margin-top:0.5em; font-style:italic;";
  //container.appendChild(statusLabel);
  
  parentNode.appendChild(container);

  function openPopup(){
    chrome.runtime.sendMessage({ action: "openPopup"});
    setTimeout(() => {
      button.removeEventListener("click", openPopup)
      button.textContent = "Retry"
      setOwnText(parentNode, "Ater setting up cloud model, try again.")
      if(callback)button.addEventListener("click", callback)
    }, 1500);
       
  }
  button.addEventListener('click', openPopup)
}

export function simpleMarkdownToHTML(markdown) {
  // Escape HTML first
  if(!markdown) return
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // Italic *text*
  // Handles spaces, punctuation, and line breaks more reliably
  html = html.replace(/(\s|^)\*(?!\s)([^*]+?)\*(\s|$)/gim, '$1<em>$2</em>$3');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Paragraphs and line breaks
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';

  return html.trim();
}
