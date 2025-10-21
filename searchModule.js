// Exports a small API for injection and result management. Styling is isolated via prefixing
// and a single <style> element injected into head. Events are emitted from the root container
// as CustomEvents: 'search-key', 'search-enter', 'result-click'.
import { positionPanelAtPoint} from "./utils/helpers.js"

const PREFIX = 'gsw'; // short prefix to avoid collisions (Gideon Search Widget)
let widgetExists = false;
let resultsContainerRef = null;
let rootContainerId = `${PREFIX}SearchContainer`;
let cssId = `${PREFIX}Styles`;
let lastMousePosition = { x: 0, y: 0 };

// ----------------- CSS Injection -----------------
export function injectCSS() {
  if (document.getElementById(cssId)) return;
  const s = document.createElement('style');
  s.id = cssId;
  s.textContent = `
  /* Isolation reset for the widget */
  #${rootContainerId}, #${rootContainerId} * { 
    all: unset; 
    box-sizing: border-box; 
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; 
  }

  /* Root container */
  #${rootContainerId} { 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    width: 100%; 
    max-width: 500px; 
  }

  /* --- Search bar and close button container --- */
  #${rootContainerId} .${PREFIX}-search-bar-container {
    display: flex;
    align-items: stretch;
    gap: 6px;
    width: 100%;
  }

  /* Search bar (multiline textarea) */
  #${rootContainerId} .${PREFIX}-search-bar { 
    flex: 1;
    min-height: calc(1.2em * 3 + 16px); 
    max-height: calc(1.2em * 3 + 16px); 
    padding: 10px; 
    border-radius: 8px; 
    resize: none; 
    overflow: auto; 
    line-height: 1.2; 
    border: 1px solid; 
    font-size: 14px;
  }

  #${rootContainerId} .${PREFIX}-search-bar::placeholder { 
    opacity: 0.7; 
  }

  /* Close / Exit Button */
  #${rootContainerId} .${PREFIX}-close-btn {
    width: 36px;
    border-radius: 8px;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid;
    transition: filter 120ms ease, transform 100ms ease;
    user-select: none;
  }

  #${rootContainerId} .${PREFIX}-close-btn:hover {
    filter: brightness(0.85);
    transform: scale(1.05);
  }

  /* Results container */
  #${rootContainerId} .${PREFIX}-results-container { 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    width: 100%; 
    align-items: stretch; 
  }

  /* Individual result */
  #${rootContainerId} .${PREFIX}-result { 
    padding: 10px; 
    border-radius: 8px; 
    cursor: default; 
    transition: transform 120ms ease, filter 120ms ease; 
    word-wrap: break-word; 
    overflow: hidden; 
    width: 100%; 
    border: 1px solid; 
  }

  /* Clamp result text to 3 lines */
  #${rootContainerId} .${PREFIX}-result .text { 
    display: -webkit-box; 
    -webkit-line-clamp: 3; 
    -webkit-box-orient: vertical; 
    overflow: hidden; 
    white-space: normal; 
  }

  /* Hover effect for results */
  #${rootContainerId} .${PREFIX}-result:hover { 
    transform: scale(1.02); 
    filter: brightness(0.92); 
    cursor: pointer; 
  }

  /* --- Light theme --- */
  @media (prefers-color-scheme: light) {
    #${rootContainerId} .${PREFIX}-search-bar { 
      background: #fff; 
      color: #111; 
      border-color: #d0d0d0; 
    }

    #${rootContainerId} .${PREFIX}-result { 
      background: #f4f8ff; 
      color: #04204a; 
      border-color: rgba(4,32,74,0.06); 
    }

    #${rootContainerId} .${PREFIX}-close-btn { 
      background: #fff; 
      color: #333; 
      border-color: #d0d0d0; 
    }
  }

  /* --- Dark theme --- */
  @media (prefers-color-scheme: dark) {
    #${rootContainerId} .${PREFIX}-search-bar { 
      background: #0f1113; 
      color: #e6eef8; 
      border-color: #30343a; 
    }

    #${rootContainerId} .${PREFIX}-result { 
      background: #111826; 
      color: #cfe3ff; 
      border-color: rgba(255,255,255,0.04); 
    }

    #${rootContainerId} .${PREFIX}-close-btn { 
      background: #0f1113; 
      color: #e6eef8; 
      border-color: #30343a; 
    }
  }
  `;
  document.head.appendChild(s);
}


// ----------------- HTML Injection -----------------
export function injectHTML(container = document.body) {
  const existing = document.getElementById(rootContainerId);
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = rootContainerId;
  root.className = `${PREFIX}-search-root`;

  // wrap search bar and close button in a flex container
  root.innerHTML = `
    <div class="${PREFIX}-search-bar-container">
      <textarea class="${PREFIX}-search-bar" placeholder="What are you looking for? Type 5 or more words that make up your query to continue" rows="3"></textarea>
      <button class="${PREFIX}-close-btn" title="Close">&times;</button>
    </div>
  `;

  container.appendChild(root);
  widgetExists = true;

  const textarea = root.querySelector(`.${PREFIX}-search-bar`);
  const closeBtn = root.querySelector(`.${PREFIX}-close-btn`);

  if (textarea) {
    textarea.addEventListener('input', (e) => {
      const ev = new CustomEvent('search-key', { detail: { value: textarea.value, originalEvent: e }, bubbles: true, composed: true });
      root.dispatchEvent(ev);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const ev = new CustomEvent('search-enter', { detail: { value: textarea.value, originalEvent: e }, bubbles: true, composed: true });
        root.dispatchEvent(ev);
      }
    });
  }

  // handle close
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const ev = new CustomEvent('search-close', { bubbles: true, composed: true });
      root.dispatchEvent(ev);
      root.remove(); // remove widget from DOM
    });
  }
  return root;
}


// ----------------- Results Helpers -----------------
// createResultsFromList(list) => returns a results container DOM node with .${PREFIX}-results-container
export function createResultsFromList(list = []) {
  const container = document.createElement('div');
  container.className = `${PREFIX}-results-container`;

  list.forEach(item => {
    const r = document.createElement('div');
    r.className = `${PREFIX}-result`;
    // id and data-id set
    if (item && (item.id !== undefined && item.id !== null)) r.setAttribute('data-id', String(item.id));

    const span = document.createElement('div');
    span.className = 'text';
    span.textContent = item && item.text ? item.text : '';
    r.appendChild(span);

    container.appendChild(r);
  });

  // attach delegated click handler for result items
  container.addEventListener('click', (ev) => {
    const target = ev.target;
    const resultEl = target.closest && target.closest(`.${PREFIX}-result`);
    if (!resultEl) return;
    const root = document.getElementById(rootContainerId);
    if (!root) return;
    const id = resultEl.getAttribute('data-id');
    const text = resultEl.textContent || '';
    const clickEv = new CustomEvent('result-click', { detail: { id, text, originalEvent: ev }, bubbles:true, composed:true });
    // dispatch from root so consumer can listen on container
    root.dispatchEvent(clickEv);
  });

  resultsContainerRef = container; // keep reference
  return container;
}

// setResultsContainer(rootEl, resultsContainerNode)
// inserts the results container into the widget root (removes previous if present)
export function setResultsContainer(rootEl, resultsNode) {
  if (!rootEl) rootEl = document.getElementById(rootContainerId);
  if (!rootEl) return false;

  // remove existing
  const existing = rootEl.querySelector(`.${PREFIX}-results-container`);
  if (existing) existing.remove();

  if (resultsNode) {
    rootEl.appendChild(resultsNode);
    resultsContainerRef = resultsNode;
    return true;
  }
  return false;
}

// deleteSearchResultContainer(el) -> removes any results container within given element (or global root if omitted)
export function deleteSearchResultContainer(el = null) {
  const container = el || document.getElementById(rootContainerId);
  if (!container) return false;
  const found = container.querySelectorAll(`.${PREFIX}-results-container`);
  let removed = false;
  found.forEach(n => { n.remove(); removed = true; });
  if (removed) resultsContainerRef = null;
  return removed;
}

// ----------------- Utility / Small API -----------------
export function inject(container = document.body, options={position:"mouse"}) {
  injectCSS();
  const rootEl = injectHTML(container); // returns root element
  if (options.position === 'mouse') {
    positionPanelAtPoint(rootEl, lastMousePosition);
  }
  return rootEl;
}

export function getSearchValue() {
  const root = document.getElementById(rootContainerId);
  if (!root) return '';
  const ta = root.querySelector(`.${PREFIX}-search-bar`);
  return ta ? ta.value : '';
}

export function setSearchValue(v) {
  const root = document.getElementById(rootContainerId);
  if (!root) return;
  const ta = root.querySelector(`.${PREFIX}-search-bar`);
  if (ta) ta.value = v;
}

export function focusSearch() {
  const root = document.getElementById(rootContainerId);
  if (!root) return;
  const ta = root.querySelector(`.${PREFIX}-search-bar`);
  if (ta) ta.focus();
}

// Small convenience to build-and-set results in one call
export function populateResults(list) {
  const root = document.getElementById(rootContainerId);
  if (!root) return null;
  const rc = createResultsFromList(list);
  setResultsContainer(root, rc);
  return rc;
}

// Expose a tiny debug helper
export function hasWidget() { return !!document.getElementById(rootContainerId); }

// Default export (optional) — keep named exports primary
export default {
  injectCSS,
  injectHTML,
  inject,
  createResultsFromList,
  setResultsContainer,
  deleteSearchResultContainer,
  populateResults,
  getSearchValue,
  setSearchValue,
  focusSearch,
  hasWidget,
};

export function init(){
  //console.log("search module ready")
  window.addEventListener('mousemove', (e) => {
    lastMousePosition = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  let keyStack = []
  let timerId = null
  window.addEventListener("keydown", (e)=>{
    //console.log(e)
    keyStack.push(e.key)
    if(keyStack.length > 3)keyStack.slice(keyStack.length - 3)
    //console.log(keyStack.length)
    if(keyStack.length == 3 && keyStack[0] == "Control" && keyStack[1] == "Shift" && keyStack[2].toLowerCase() == "f"){
      e.stopPropagation()
      inject();
      keyStack = []
      //console.log(keyStack)
      return
    }
    //if(timerId != null) clearTimeout(timerId)
    timerId = setTimeout(() => {
      keyStack.shift()
      //console.log(keyStack)
    }, 1000);
  })

  window.addEventListener('search-key', (e)=>{
    
  })

  window.addEventListener("search-enter", (e)=>{
  })
}
