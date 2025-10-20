/**
* Position a floating panel (fixed) relative to a Selection.
* - Uses selection bounding rect (with fallbacks).
* - Prefers below, then above; otherwise centers and gently shifts toward selection.
* - Clips so the panel is always fully visible in viewport.
*
* @param {Selection} selection - window.getSelection()
* @param {HTMLElement} panel - element to position (preferably appended to document.body)
* @param {Object} [opts]
* @param {number} [opts.margin=8] - gap between selection and panel
* @param {number} [opts.biasFactor=0.25] - how strongly to shift from center toward selection in fallback (0..1)
* @param {boolean} [opts.ensureInBody=true] - if true, append panel to document.body when not already inside it
* @returns {{top:number,left:number,placement:string}} positions in viewport px and placement label
*/
export function positionPanel(selection, panel, opts = {}) {
  const {
    margin = 8,
    biasFactor = 0.25,
    ensureInBody = true,
  } = opts;
  if (!selection || selection.rangeCount === 0 || !panel) {
    return null;
  }
  // Ensure panel is in body to avoid transformed-ancestor weirdness with fixed.
  if (ensureInBody && panel.ownerDocument && panel.ownerDocument.body && panel.parentElement !== panel.ownerDocument.body) {
    panel.ownerDocument.body.appendChild(panel);
  }
  // Helper: safe measurement even if panel is display:none
  function measurePanel(el) {
    const computed = getComputedStyle(el);
    let restored = null;
    if (computed.display === 'none') {
      // Temporarily make it measurable but invisible.
      restored = {
        visibility: el.style.visibility,
        display: el.style.display,
        position: el.style.position,
      };
      el.style.visibility = 'hidden';
      el.style.display = 'block';
      // position fixed so layout matches final context
      el.style.position = el.style.position || 'fixed';
      // Append temporarily if not connected
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
  // Obtain a reliable bounding rect for the visible selection
  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();
  // If bounding rect is empty or zero-area (caret or multi-rect), try clientRects
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const clientRects = Array.from(range.getClientRects()).filter(r => r.width > 0 || r.height > 0);
    if (clientRects.length > 0) {
      rect = clientRects[0];
    } else {
      // As a last resort, try bounding box of anchorNode's element
      const node = selection.anchorNode && (selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement);
      if (node && node.getBoundingClientRect) {
        rect = node.getBoundingClientRect();
      } else {
        // Nothing usable: place center fallback with no shift
        rect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0, bottom: window.innerHeight / 2 };
      }
    }
  }
  const { width: panelWidth, height: panelHeight } = measurePanel(panel);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Defensive handling for panel bigger than viewport
  const maxLeft = Math.max(vw - panelWidth, 0);
  const maxTop = Math.max(vh - panelHeight, 0);
  const selectionCenterX = rect.left + (rect.width || 0) / 2;
  const selectionCenterY = rect.top + (rect.height || 0) / 2;
  let top = 0;
  let left = 0;
  let placement = 'center';
  const spaceBelow = vh - (rect.bottom !== undefined ? rect.bottom : rect.top + (rect.height || 0));
  const spaceAbove = rect.top;
  // 1. Prefer below
  if (spaceBelow >= panelHeight + margin) {
    top = (rect.bottom !== undefined ? rect.bottom : rect.top + (rect.height || 0)) + margin;
    placement = 'below';
  } else if (spaceAbove >= panelHeight + margin) {
    // 2. Else above
    top = rect.top - panelHeight - margin;
    placement = 'above';
  } else {
    // 3. Fallback: center & shift toward selection
    const centerX = (vw - panelWidth) / 2; // same as vw/2 - panelWidth/2
    const centerY = (vh - panelHeight) / 2;
    // target aligned to selection center but clipped to viewport
    const targetX = Math.min(Math.max(selectionCenterX - panelWidth / 2, 0), maxLeft);
    const targetY = Math.min(Math.max(selectionCenterY - panelHeight / 2, 0), maxTop);
    left = centerX + (targetX - centerX) * biasFactor;
    top = centerY + (targetY - centerY) * biasFactor;
    placement = 'center';
  }
  // Horizontal centering for above/below placement
  if (placement === 'above' || placement === 'below') {
    left = selectionCenterX - panelWidth / 2;
  }
  // Clip to viewport
  left = Math.min(Math.max(left, 0), maxLeft);
  top = Math.min(Math.max(top, 0), maxTop);
  // Apply final styling
  panel.style.position = 'fixed';
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  // Ensure visible stacking; you may customize or remove this
  if (!panel.style.zIndex) panel.style.zIndex = '9999';
  return { top: Math.round(top), left: Math.round(left), placement };
}